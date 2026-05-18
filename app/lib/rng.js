// Seeded RNG — mulberry32. Single-integer state, fast, well-distributed.
// Used so a (seed, config) pair produces identical sim output. Live world
// can also serialise rng.state alongside meta.seed to survive save/load.
//
// Usage:
//   const rng = createRng(seed);
//   rng();             // → float in [0, 1)
//   rng.state          // → current internal state (integer); save this
//   rng.state = 12345; // restore state after load

function createRng(seed) {
  let state = (seed | 0) >>> 0;
  const fn = function rng() {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Object.defineProperty(fn, 'state', {
    get() { return state; },
    set(v) { state = (v | 0) >>> 0; },
  });
  return fn;
}

module.exports = { createRng };
