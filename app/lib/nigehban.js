// Almari Shroom — Nigehban orchestration.
// Watches the world, calls the cloud LLM on triggers, applies the response.
// Graceful failure: sim keeps ticking even when the LLM call fails.

const Anthropic = require('@anthropic-ai/sdk');
const fs    = require('fs');
const path  = require('path');

const { buildSnapshot, simDay } = require('./snapshot');
const persistence = require('./persistence');
const observability = require('./observability');
const aiUsageReporter = require('./ai-usage-reporter');
const { sowAt, logEvent, W, H, AIR, SOIL, LOG, FRUIT } = require('./world');
const { randomGenome, phenotypeWords } = require('./genome');

const MODEL       = process.env.NIGEHBAN_MODEL || 'claude-haiku-4-5';
const TIMEOUT_MS  = parseInt(process.env.NIGEHBAN_TIMEOUT_MS || '30000', 10);
// 600 ticks ≈ 30 real minutes — periodic wakes (no events pending).
const PERIODIC_INTERVAL_TICKS = parseInt(process.env.NIGEHBAN_INTERVAL_TICKS || '600', 10);
// 200 ticks ≈ 10 real minutes — hard floor between ANY two calls (events included).
// Prevents burst-flooding the API if event triggers cluster (toofan + first-fruit + colony-death).
const MIN_GAP_TICKS = parseInt(process.env.NIGEHBAN_MIN_GAP_TICKS || '200', 10);
// Sliding 24h window. At MIN_GAP_TICKS=200/3s=10min, theoretical ceiling is 144/day;
// 48 keeps daily cost under ~$0.10 at Haiku 4.5 rates with typical ~1k-token snapshots.
const DAILY_CAP = parseInt(process.env.NIGEHBAN_DAILY_CAP || '48', 10);

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic({ timeout: TIMEOUT_MS }) : null;

const PROMPT_PATH = path.join(__dirname, 'nigehban-prompt.txt');
const SYSTEM_PROMPT = fs.existsSync(PROMPT_PATH)
  ? fs.readFileSync(PROMPT_PATH, 'utf8')
  : 'You are Nigehban. Respond in JSON.';

const state = {
  lastInvocationTick: 0,
  pendingReason: null,        // event-driven trigger waiting to be served
  busy: false,
  lastError: null,
  lastResponseAt: null,
  lastEntry: null,
  callCount: 0,
  callTimestamps: [],         // unix ms of past calls — 24h sliding window
  skippedCount: 0,
  lastSkipReason: null,
};

function pruneCallWindow(nowMs) {
  const cutoff = nowMs - 24 * 3600 * 1000;
  while (state.callTimestamps.length > 0 && state.callTimestamps[0] < cutoff) {
    state.callTimestamps.shift();
  }
}

function callsInLastMs(windowMs) {
  const cutoff = Date.now() - windowMs;
  return state.callTimestamps.filter(t => t >= cutoff).length;
}

function notify(reason) {
  if (!state.pendingReason) state.pendingReason = reason;
}

function shouldWake(world) {
  if (state.busy) return false;
  const sinceLastCall = world.meta.tick - state.lastInvocationTick;
  if (sinceLastCall < MIN_GAP_TICKS) {
    if (state.pendingReason) state.lastSkipReason = 'min-gap';
    return false;
  }
  pruneCallWindow(Date.now());
  if (state.callTimestamps.length >= DAILY_CAP) {
    state.lastSkipReason = 'daily-cap';
    state.skippedCount++;
    return false;
  }
  if (state.pendingReason) return true;                          // event-driven
  return sinceLastCall >= PERIODIC_INTERVAL_TICKS;               // periodic
}

async function tryWake(world) {
  if (!shouldWake(world)) return;
  state.busy = true;
  const reason = state.pendingReason || 'periodic';
  state.pendingReason = null;
  const startMs = Date.now();
  let parsed = null;
  let error = null;
  try {
    const journal = persistence.loadJournal();
    const hall    = persistence.loadHall();
    const snapshot = buildSnapshot(world, journal, hall, world.events, reason);
    const text = await callLLM(snapshot, reason);
    state.lastInvocationTick = world.meta.tick;
    state.callCount++;
    state.callTimestamps.push(Date.now());
    if (process.env.NIGEHBAN_DEBUG) console.log(`[nigehban] reason=${reason} raw=${text.slice(0, 400)}`);
    parsed = parseResponse(text);
    if (!parsed) {
      state.lastError = 'unparseable response';
      error = state.lastError;
    } else {
      state.lastError = null;
      applyResponse(world, parsed, reason);
    }
  } catch (err) {
    state.lastError = err.message;
    error = err.message;
    // sim keeps ticking
  } finally {
    state.busy = false;
    observability.recordNigehban({
      tick: world.meta.tick,
      vol: world.meta.volume,
      reason,
      latencyMs: Date.now() - startMs,
      ok: !error,
      error: error || null,
      hadEntry:    !!(parsed && typeof parsed.entry === 'string' && parsed.entry.trim()),
      hadName:     !!(parsed && parsed.name && typeof parsed.name === 'object'),
      hadAction:   !!(parsed && parsed.action && typeof parsed.action === 'object'),
      hadInscribe: !!(parsed && parsed.inscribe && typeof parsed.inscribe === 'object'),
    });
  }
}

async function callLLM(snapshot, reason) {
  if (!client) throw new Error('ANTHROPIC_API_KEY not set');
  const tStart = Date.now();
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    temperature: 0.85,
    system: [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ],
    messages: [
      { role: 'user', content: JSON.stringify(snapshot, null, 2) },
    ],
  });
  aiUsageReporter.report({
    app: 'shroom',
    provider: 'anthropic',
    model: MODEL,
    input_tokens:       resp.usage?.input_tokens || 0,
    output_tokens:      resp.usage?.output_tokens || 0,
    cache_read_tokens:  resp.usage?.cache_read_input_tokens || 0,
    cache_write_tokens: resp.usage?.cache_creation_input_tokens || 0,
    latency_ms: Date.now() - tStart,
    context: reason || null,
  });
  const block = (resp.content || []).find(b => b.type === 'text');
  return block ? block.text : '';
}

function parseResponse(text) {
  if (!text || typeof text !== 'string') return null;
  try { return JSON.parse(text); } catch {}
  // Some models wrap or pad — try extracting first JSON object
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

function applyResponse(world, r, reason) {
  if (typeof r !== 'object' || r === null) return;

  if (typeof r.entry === 'string' && r.entry.trim()) {
    const entry = {
      tick: world.meta.tick,
      day: simDay(world),
      volume: world.meta.volume,
      reason,
      text: r.entry.trim(),
    };
    persistence.appendJournal(entry);
    state.lastEntry = entry;
    state.lastResponseAt = Date.now();
    logEvent(world, 'journal', `nigehban wrote: "${entry.text.slice(0, 60)}${entry.text.length > 60 ? '…' : ''}"`);
  }

  if (r.name && typeof r.name === 'object') {
    applyName(world, r.name);
  }
  if (r.action && typeof r.action === 'object') {
    applyAction(world, r.action);
  }
  if (r.inscribe && typeof r.inscribe === 'object') {
    applyInscribe(world, r.inscribe);
  }
}

// ── Name ────────────────────────────────────────────────

function applyName(world, n) {
  const idStr = String(n.candidate_id || '');
  const name  = String(n.name || '').trim();
  if (!idStr || !name) return;
  const idNum = parseInt(idStr.replace(/^c/, ''), 10);
  if (!Number.isFinite(idNum)) return;
  const col = world.colonies[idNum];
  if (!col || !col.alive || col.name) return;
  col.name = name;
  logEvent(world, 'name', `nigehban named colony ${idNum}: ${name}`);
}

// ── Actions ─────────────────────────────────────────────

function applyAction(world, a) {
  const tool = String(a.tool || '').toLowerCase();
  if (!world.tools) world.tools = {};
  switch (tool) {
    case 'sow':    return doSow(world, a);
    case 'kindle': return doKindle(world, a);
    case 'blight': return doBlight(world, a);
    case 'spare':  return doSpare(world, a);
  }
}

function doSow(world, a) {
  if (world.tools.sowUsedInVolume === world.meta.volume) return;
  let x, y;
  if (a.target && Array.isArray(a.target) && a.target.length >= 2) {
    x = clampInt(a.target[0], 0, W - 1);
    y = clampInt(a.target[1], 0, H - 1);
  } else if (a.target && typeof a.target === 'object') {
    x = clampInt(a.target.x ?? Math.floor(W/2), 0, W - 1);
    y = clampInt(a.target.y ?? Math.floor(H*0.45), 0, H - 1);
  } else {
    // pick random log cell
    const lb = world.meta.logBounds || { x0: 0, y0: 0, w: W, h: H };
    x = lb.x0 + Math.floor(Math.random() * lb.w);
    y = lb.y0 + Math.floor(Math.random() * lb.h);
  }
  const id = sowAt(world, x, y, randomGenome());
  if (id) {
    world.tools.sowUsedInVolume = world.meta.volume;
    logEvent(world, 'action', `nigehban sowed → colony ${id} at (${x},${y})`);
  }
}

function doKindle(world, a) {
  if (world.tools.kindleUsedInSeason === world.meta.season) return;
  const cx = clampInt(a.target?.x ?? a.target?.[0] ?? Math.floor(W/2), 0, W - 1);
  const cy = clampInt(a.target?.y ?? a.target?.[1] ?? Math.floor(H*0.5), 0, H - 1);
  const r  = clampInt(a.target?.radius ?? 6, 2, 15);
  const { kind, nutrient, colony, age } = world.grid;
  let cleared = 0;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx*dx + dy*dy > r*r) continue;
      const x = cx + dx, y = cy + dy;
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      const i = y * W + x;
      if (colony[i] !== 0) { colony[i] = 0; age[i] = 0; cleared++; }
      if (kind[i] === FRUIT) kind[i] = AIR;
      // ash boost on substrate cells
      if (kind[i] === LOG || kind[i] === SOIL) {
        nutrient[i] = Math.min(100, nutrient[i] + 30);
      }
    }
  }
  world.tools.kindleUsedInSeason = world.meta.season;
  logEvent(world, 'action', `nigehban kindled at (${cx},${cy}) — ${cleared} cells cleared`);
}

function doBlight(world, a) {
  if (world.tools.blightUsedInSeason === world.meta.season) return;
  const id = parseInt(String(a.target || '').replace(/^c/, ''), 10);
  if (!Number.isFinite(id)) return;
  const col = world.colonies[id];
  if (!col || !col.alive) return;
  col.blightedUntil = world.meta.tick + 400;
  world.tools.blightUsedInSeason = world.meta.season;
  logEvent(world, 'action', `nigehban blighted colony ${id} (${col.name || col.placeholderName || 'unnamed'})`);
}

function doSpare(world, a) {
  if (world.tools.spareUsedInSeason === world.meta.season) return;
  const id = parseInt(String(a.target || '').replace(/^c/, ''), 10);
  if (!Number.isFinite(id)) return;
  const col = world.colonies[id];
  if (!col || !col.alive) return;
  col.sparedUntil = world.meta.tick + 600;
  world.tools.spareUsedInSeason = world.meta.season;
  logEvent(world, 'action', `nigehban spared colony ${id} (${col.name || col.placeholderName || 'unnamed'})`);
}

// ── Inscribe ────────────────────────────────────────────

function applyInscribe(world, ins) {
  const id = parseInt(String(ins.colony_id || '').replace(/^c/, ''), 10);
  if (!Number.isFinite(id)) return;
  const col = world.colonies[id];
  if (!col) return;
  const hall = persistence.loadHall();
  // Avoid duplicate inscriptions for the same colony in the same volume
  if (hall.find(h => h.volume === world.meta.volume && h.colonyId === id)) return;
  hall.push({
    name: col.name || col.placeholderName || `volume-${world.meta.volume}-c${id}`,
    volume: world.meta.volume,
    colonyId: id,
    phenotype: phenotypeWords(col.genome),
    cap_hue:    col.genome[6],
    cap_shape:  Math.floor(col.genome[7]),
    cap_size:   col.genome[8],
    stem_length:col.genome[9],
    reason:   String(ins.reason   || '').slice(0, 80),
    epitaph:  String(ins.epitaph  || '').slice(0, 240),
  });
  persistence.saveHall(hall);
  logEvent(world, 'inscribe', `inscribed: ${col.name || col.placeholderName || 'unnamed'} (volume ${world.meta.volume})`);
}

// ── Hooks for sim events ────────────────────────────────

function onSeasonChange(world)   { notify('season-change'); }
function onToofanWarning(world)  { notify('toofan-warning'); }
function onToofan(world)         { notify('toofan'); }
function onFirstFruit(world, c)  { notify('first-fruit'); }
function onColonyDeath(world, c) { notify('colony-death'); }
function onWorldEmpty(world)     { notify('empty-world'); }

// ── Tool reset on volume / season transitions ──────────

function resetVolumeTools(world) {
  if (!world.tools) world.tools = {};
  world.tools.sowUsedInVolume = null;
}

function resetSeasonTools(world) {
  if (!world.tools) world.tools = {};
  world.tools.kindleUsedInSeason = null;
  world.tools.blightUsedInSeason = null;
  world.tools.spareUsedInSeason  = null;
}

// ── Helpers ─────────────────────────────────────────────

function clampInt(v, lo, hi) { v = parseInt(v, 10); if (!Number.isFinite(v)) v = lo; return Math.max(lo, Math.min(hi, v)); }

function usage() {
  pruneCallWindow(Date.now());
  return {
    callsLast24h: state.callTimestamps.length,
    callsLastHour: callsInLastMs(3600 * 1000),
    dailyCap: DAILY_CAP,
    skippedCount: state.skippedCount,
    lastSkipReason: state.lastSkipReason,
    minGapTicks: MIN_GAP_TICKS,
    periodicIntervalTicks: PERIODIC_INTERVAL_TICKS,
  };
}

module.exports = {
  tryWake, notify, shouldWake,
  applyResponse, // exposed for test/debug
  onSeasonChange, onToofanWarning, onToofan, onFirstFruit, onColonyDeath, onWorldEmpty,
  resetVolumeTools, resetSeasonTools,
  state, usage,
  MODEL,
};
