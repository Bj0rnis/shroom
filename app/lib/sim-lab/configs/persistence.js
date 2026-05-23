// Persistence config — Vision 2, week-on-log scenario. Same five seeds
// as the baseline so cross-vision comparison is possible. Each run takes
// ~10 min; the full sweep is ~50 min.

const { VISION_2_PERSISTENCE } = require('../targets');

module.exports = {
  id: 'persistence',
  description: 'Week-on-log scenario. Vision 2 — does the painting persist?',
  vision: VISION_2_PERSISTENCE,
  seeds: [42, 1337, 314, 271, 555],
  expectedConstants: {},
};
