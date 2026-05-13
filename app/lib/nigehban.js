// Almari Shroom — Nigehban orchestration.
// Watches the world, calls Ollama on triggers, applies the response.
// Graceful failure: sim keeps ticking even when Ollama is down.

const fetch = require('node-fetch');
const fs    = require('fs');
const path  = require('path');

const { buildSnapshot, simDay } = require('./snapshot');
const persistence = require('./persistence');
const observability = require('./observability');
const { sowAt, logEvent, W, H, AIR, SOIL, LOG, FRUIT } = require('./world');
const { randomGenome, phenotypeWords } = require('./genome');

const OLLAMA_URL  = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL       = process.env.NIGEHBAN_MODEL || 'llama3.2:3b';
const TIMEOUT_MS  = parseInt(process.env.NIGEHBAN_TIMEOUT_MS || '30000', 10);
// 600 ticks ≈ 30 real minutes — quiet enough that he watches, not runs the world.
const MIN_INTERVAL_TICKS = parseInt(process.env.NIGEHBAN_INTERVAL_TICKS || '600', 10);

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
};

function notify(reason) {
  if (!state.pendingReason) state.pendingReason = reason;
}

function shouldWake(world) {
  if (state.busy) return false;
  if (state.pendingReason) return true;
  if (world.meta.tick - state.lastInvocationTick >= MIN_INTERVAL_TICKS) return true;
  return false;
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
    const text = await callOllama(snapshot);
    state.lastInvocationTick = world.meta.tick;
    state.callCount++;
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

async function callOllama(snapshot) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user',   content: JSON.stringify(snapshot, null, 2) },
  ];
  const r = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: false,
      format: 'json',
      options: { temperature: 0.85 },
    }),
    timeout: TIMEOUT_MS,
  });
  if (!r.ok) throw new Error(`Ollama HTTP ${r.status}`);
  const data = await r.json();
  return data.message?.content || '';
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
  logEvent(world, 'action', `nigehban blighted colony ${id} (${col.name || 'unnamed'})`);
}

function doSpare(world, a) {
  if (world.tools.spareUsedInSeason === world.meta.season) return;
  const id = parseInt(String(a.target || '').replace(/^c/, ''), 10);
  if (!Number.isFinite(id)) return;
  const col = world.colonies[id];
  if (!col || !col.alive) return;
  col.sparedUntil = world.meta.tick + 600;
  world.tools.spareUsedInSeason = world.meta.season;
  logEvent(world, 'action', `nigehban spared colony ${id} (${col.name || 'unnamed'})`);
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
    name: col.name || `volume-${world.meta.volume}-c${id}`,
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
  logEvent(world, 'inscribe', `inscribed: ${col.name || 'unnamed'} (volume ${world.meta.volume})`);
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

module.exports = {
  tryWake, notify, shouldWake,
  applyResponse, // exposed for test/debug
  onSeasonChange, onToofanWarning, onToofan, onFirstFruit, onColonyDeath, onWorldEmpty,
  resetVolumeTools, resetSeasonTools,
  state,
  OLLAMA_URL, MODEL,
};
