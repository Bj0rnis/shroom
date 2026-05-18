// Baseline config — current main constants, default seed set, vision 1.
// Configs are descriptive: they document the *intended* sim state so a
// future session can reproduce. Actual constants live in sim.js; the lab
// runs whatever is there.

const { VISION_1_DAY1_ROOT } = require('../targets');

module.exports = {
  id: 'baseline',
  description: 'Current main constants. Vision 1 reference run.',
  vision: VISION_1_DAY1_ROOT,
  seeds: [42, 1337, 314, 271, 555],
  // Constants the lab expects to find in sim.js for this config. If they
  // differ, the report should note it. Pure documentation today.
  expectedConstants: {
    // (filled in after first baseline run + read of sim.js current state)
  },
};
