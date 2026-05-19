// Parses NOTES.md and PROCESS.md into structured data the /research
// dashboard can render. Source markdown stays authoritative — this
// module is a *view* on it.
//
// Tolerant parser: malformed or partial entries don't crash; missing
// fields come back as null. The contract is the entry shape in
// PROCESS.md's "NOTES.md entry format" section.

const fs = require('fs');
const path = require('path');

// Match heading like:  ## 2026-05-18 · sim-lab/01-leading-hyphae · iter-5 · [mechanic]
// or the older form:   ## 2026-05-18 · sim-lab/foundation · [mechanic]
const HEADING_RE = /^##\s+(\d{4}-\d{2}-\d{2})\s*·\s*([^·]+?)(?:\s*·\s*(iter-\d+))?\s*·\s*\[([^\]]+)\]\s*$/;

// In-body field lines: `Field: value`. Capital-led word(s) up to the
// first colon. Permissive on what comes before the colon so unknown
// "Foundation pass:"-style prefixes still reset the active field instead
// of being mistaken for wrap-lines.
const FIELD_RE = /^([A-Z][A-Za-z]+(?:\s+[a-z]+)*?):\s*(.*)$/;

function parseNotes(md) {
  const lines = md.split('\n');
  const entries = [];
  let current = null;
  let activeField = null;     // which field a wrap-line should append to
  let asciiBuf = null;        // collecting lines inside an ```ascii``` block

  function flush() {
    if (!current) return;
    entries.push(current);
    current = null;
    activeField = null;
    asciiBuf = null;
  }

  for (const line of lines) {
    // Inside an ascii fenced block: collect raw lines until closing fence.
    if (asciiBuf !== null) {
      if (/^```\s*$/.test(line)) {
        if (current) current.ascii = asciiBuf.join('\n');
        asciiBuf = null;
      } else {
        asciiBuf.push(line);
      }
      continue;
    }
    // Open an ascii block — only inside a current entry.
    if (current && /^```ascii\s*$/.test(line)) {
      asciiBuf = [];
      activeField = null;
      continue;
    }

    const h = line.match(HEADING_RE);
    if (h) {
      flush();
      current = {
        date:   h[1],
        branch: h[2].trim(),
        iter:   h[3] || null,
        tag:    h[4],
        agent:       null,
        plain:       null,
        hypothesis:  null,
        setup:       null,
        result:      null,
        reading:     null,
        next:        null,
        ascii:       null,
      };
      activeField = null;
      continue;
    }
    if (!current) continue;

    // Blank line ends the active field.
    if (!line.trim()) { activeField = null; continue; }

    const f = line.match(FIELD_RE);
    if (f) {
      const key = f[1].toLowerCase();
      if (key in current) {
        current[key] = f[2].trim();
        activeField = key;
      } else {
        // Unknown field-shaped line — drop, and stop appending to the
        // previous field so foreign prose doesn't bleed into Plain etc.
        activeField = null;
      }
      continue;
    }

    // Wrap-line: append to the active field with a space separator.
    if (activeField && current[activeField] != null) {
      current[activeField] = (current[activeField] + ' ' + line.trim()).trim();
    }
  }
  flush();

  // Extract per-scorer pass-counts from the result string. Allowed scorer
  // names come from targets.js so narrative fragments like "hits 5/6"
  // don't get mistaken for scores. If a new scorer lands in targets.js,
  // it shows up here without further code change.
  const ALLOWED = collectScorerNames();
  for (const e of entries) {
    if (!e.result) { e.scores = []; continue; }
    const scores = [];
    const re = /([a-zA-Z][a-zA-Z0-9_]*)\s+(\d+)\/(\d+)/g;
    let m;
    while ((m = re.exec(e.result)) !== null) {
      if (!ALLOWED.has(m[1])) continue;
      scores.push({ name: m[1], pass: parseInt(m[2], 10), of: parseInt(m[3], 10) });
    }
    e.scores = scores;
  }

  // Newest-first.
  entries.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    // Same date: sort by iter number desc when present.
    const an = a.iter ? parseInt(a.iter.replace('iter-', ''), 10) : 0;
    const bn = b.iter ? parseInt(b.iter.replace('iter-', ''), 10) : 0;
    return bn - an;
  });
  return entries;
}

// Pull the hypothesis-buffet table out of PROCESS.md. Returns
// [{ name, oneLiner, status }]. Status is 'current' | 'tried' | 'untried',
// derived by matching name fragments against the NOTES.md branches +
// reading sections.
function parseHypotheses(processMd, notesEntries) {
  const lines = processMd.split('\n');
  const rows = [];
  let inBuffet = false;
  let pastSep = false;

  for (const line of lines) {
    if (line.startsWith('## Hypothesis buffet')) { inBuffet = true; continue; }
    if (!inBuffet) continue;
    if (line.startsWith('## ')) break;
    if (/^\|[\s-]+\|[\s-]+\|/.test(line)) { pastSep = true; continue; }
    if (!pastSep) continue;

    const cells = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/);
    if (!cells) continue;
    // Name is bolded with **; strip.
    const name = cells[1].replace(/\*\*/g, '').trim();
    const one  = cells[2].trim();
    rows.push({ name, oneLiner: one, status: 'untried' });
  }

  // Mark statuses. The current active mechanic is named in the buffet
  // row that includes "Current" in its one-liner. Past mechanic classes
  // can be marked by writing `Tried: <name>` lines under the buffet —
  // explicit, not heuristic. Heuristic matching against NOTES.md proved
  // unreliable: common words like "shape" caused false positives.
  for (const r of rows) {
    if (/current/i.test(r.oneLiner)) r.status = 'current';
  }
  const triedMatches = [...processMd.matchAll(/^Tried:\s*(.+)$/gim)];
  const triedNames = new Set(triedMatches.map(m => m[1].trim().toLowerCase()));
  for (const r of rows) {
    if (r.status === 'current') continue;
    if (triedNames.has(r.name.toLowerCase())) r.status = 'tried';
  }

  return rows;
}

function collectScorerNames() {
  try {
    const targets = require('./targets');
    const names = new Set();
    for (const k of Object.keys(targets)) {
      const v = targets[k];
      if (v && Array.isArray(v.scorers)) {
        for (const s of v.scorers) if (s && s.name) names.add(s.name);
      }
    }
    return names;
  } catch {
    return new Set();
  }
}

function readLabDocs(libRoot) {
  const root = libRoot || path.join(__dirname);
  const read = (name) => {
    const p = path.join(root, name);
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  };
  return {
    notes:    read('NOTES.md'),
    research: read('RESEARCH.md'),
    process:  read('PROCESS.md'),
  };
}

module.exports = { parseNotes, parseHypotheses, readLabDocs };
