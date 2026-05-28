// Research v3 config — runs Vision 1 against the multi-day scenario
// (founder only, 3 days, germination disabled, best-of-snapshots
// scoring). Default seed set, telemetry on. See 1-1.md 2026-05-28 for
// why this exists.

const { VISION_1_V3 } = require('../targets');

module.exports = {
  id: 'v3',
  description: 'Research v3 — Vision 1 against the 3-day founder-only scenario.',
  vision: VISION_1_V3,
  seeds: [42, 1337, 314, 271, 555],
  telemetry: true,
  expectedConstants: {
    // Filled in after first v3 baseline run + read of sim.js current state.
  },
};
