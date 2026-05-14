// home-server Shroom — JSON persistence.
// Lesson from Evochora: persist state, not history. One world.json snapshot,
// rewritten atomically every N ticks. Journal is append-only short text.

const fs   = require('fs');
const path = require('path');
const { freshLifetime } = require('./world');

const DATA_DIR     = process.env.SHROOM_DATA_DIR || path.join(__dirname, '..', 'data');
const CURRENT_DIR  = path.join(DATA_DIR, 'current');
const LIBRARY_DIR  = path.join(DATA_DIR, 'library');
const WORLD_PATH   = path.join(CURRENT_DIR, 'world.json');
const JOURNAL_PATH = path.join(CURRENT_DIR, 'journal.json');
const META_PATH    = path.join(CURRENT_DIR, 'meta.json');
const HALL_PATH    = path.join(DATA_DIR, 'hall.json');

function ensureDirs() {
  fs.mkdirSync(CURRENT_DIR,  { recursive: true });
  fs.mkdirSync(LIBRARY_DIR,  { recursive: true });
}

function atomicWrite(p, data) {
  ensureDirs();
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, p);
}

// ── World snapshot ──────────────────────────────────────

function serializeWorld(world) {
  return {
    meta: world.meta,
    shape: world.shape,
    nextColonyId: world.nextColonyId,
    grid: {
      kind:     Array.from(world.grid.kind),
      nutrient: Array.from(world.grid.nutrient),
      moisture: Array.from(world.grid.moisture),
      colony:   Array.from(world.grid.colony),
      age:      Array.from(world.grid.age),
    },
    colonies: world.colonies,
    spores:   world.spores,
    fruits:   world.fruits,
    events:   world.events.slice(-30),
  };
}

function hydrateWorld(raw) {
  const cellCount = raw.shape[0] * raw.shape[1];
  // Migration: legacy worlds (pre-Phase-2) don't have meta.lifetime. Initialise
  // counters to zero. Pre-existing history isn't back-filled — the running
  // totals start counting forward from this point.
  if (raw.meta && !raw.meta.lifetime) raw.meta.lifetime = freshLifetime();
  return {
    meta: raw.meta,
    shape: raw.shape,
    grid: {
      kind:     Uint8Array.from(raw.grid.kind),
      nutrient: Uint8Array.from(raw.grid.nutrient),
      moisture: Uint8Array.from(raw.grid.moisture),
      colony:   Uint16Array.from(raw.grid.colony),
      age:      Uint16Array.from(raw.grid.age),
    },
    colonies: raw.colonies || {},
    nextColonyId: raw.nextColonyId || 1,
    spores: raw.spores || [],
    fruits: raw.fruits || [],
    events: raw.events || [],
    journal: [],
  };
}

function saveWorld(world) {
  const data = JSON.stringify(serializeWorld(world));
  atomicWrite(WORLD_PATH, data);
  world.meta.lastSavedTick = world.meta.tick;
}

function loadWorld() {
  try {
    if (!fs.existsSync(WORLD_PATH)) return null;
    const raw = JSON.parse(fs.readFileSync(WORLD_PATH, 'utf8'));
    return hydrateWorld(raw);
  } catch (err) {
    console.error('shroom: failed to load world.json — starting fresh.', err.message);
    return null;
  }
}

// ── Journal ─────────────────────────────────────────────

function loadJournal() {
  try {
    if (!fs.existsSync(JOURNAL_PATH)) return [];
    return JSON.parse(fs.readFileSync(JOURNAL_PATH, 'utf8'));
  } catch { return []; }
}

function saveJournal(journal) {
  atomicWrite(JOURNAL_PATH, JSON.stringify(journal));
}

function appendJournal(entry) {
  const j = loadJournal();
  j.push(entry);
  saveJournal(j);
  return j;
}

// ── Volume rotation (toofan-end) ────────────────────────

function rotateVolume(volumeNumber) {
  ensureDirs();
  const journal = loadJournal();
  if (!journal.length) return;
  const filename = `vol-${String(volumeNumber).padStart(3, '0')}.json`;
  atomicWrite(path.join(LIBRARY_DIR, filename), JSON.stringify(journal));
  saveJournal([]);
}

// ── Hall of fame ────────────────────────────────────────

function loadHall() {
  try {
    if (!fs.existsSync(HALL_PATH)) return [];
    return JSON.parse(fs.readFileSync(HALL_PATH, 'utf8'));
  } catch { return []; }
}

function saveHall(hall) {
  atomicWrite(HALL_PATH, JSON.stringify(hall));
}

module.exports = {
  DATA_DIR, CURRENT_DIR, LIBRARY_DIR,
  saveWorld, loadWorld,
  loadJournal, saveJournal, appendJournal,
  rotateVolume,
  loadHall, saveHall,
};
