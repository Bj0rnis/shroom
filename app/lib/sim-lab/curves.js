// Curves library. Standardised shapes for the ad-hoc taper / ramp /
// discount math that's scattered through sim.js (founder boost taper,
// starvation ramp, fruit cost discount, age decay, etc).
//
// Each function takes a normalised input t ∈ [0, 1] (or a raw value with
// a `from`/`to` range) and returns a multiplier ∈ [0, 1]. Callers then
// scale into their actual range. Keeps tuning experiments to "swap the
// curve" instead of "rewrite the formula."
//
// The principle: all balance shapes belong in one place. In shroom these
// are mechanic shapes (growth rate over colony age, intake over substrate,
// etc), not difficulty curves, but the structural idea — one library, all
// the shapes — is the same.

'use strict';

function clamp01(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }

// Linear ramp 0..1.
function linear(t) { return clamp01(t); }

// Power curve. exp < 1 ramps fast at low t; exp > 1 ramps slow at low t.
//   - sqrt-like (0.5): fast climb, gentle finish — good for absorption
//   - cube (3.0): slow start, sharp finish — good for starvation pressure
function power(t, exp) { return Math.pow(clamp01(t), exp); }

// Sigmoid centred at midpoint with steepness k. Always crosses 0.5 at
// midpoint. Sharper k → tighter S. Useful when you want a soft threshold:
// most of the action happens in a narrow band around midpoint.
function sigmoid(t, midpoint = 0.5, k = 10) {
  return 1 / (1 + Math.exp(-k * (t - midpoint)));
}

// Inverse-linear taper. taper(0)=1, taper(1)=0. The shape the founder
// boost uses: full effect at t=0, fades to zero by t=1.
function taper(t) { return 1 - clamp01(t); }

// Piecewise lerp. waypoints = [[t0, v0], [t1, v1], ...]. Sorted by t.
// Linear interpolation between the bracketing pair; clamps at edges.
function piecewise(t, waypoints) {
  if (!waypoints.length) return 0;
  if (t <= waypoints[0][0]) return waypoints[0][1];
  if (t >= waypoints[waypoints.length - 1][0]) return waypoints[waypoints.length - 1][1];
  for (let i = 1; i < waypoints.length; i++) {
    if (t <= waypoints[i][0]) {
      const [t0, v0] = waypoints[i - 1];
      const [t1, v1] = waypoints[i];
      const u = (t - t0) / (t1 - t0);
      return v0 + (v1 - v0) * u;
    }
  }
  return waypoints[waypoints.length - 1][1];
}

// Convenience: normalise a value into [0, 1] given a from..to range.
function normalise(value, from, to) {
  if (to === from) return 0;
  return clamp01((value - from) / (to - from));
}

module.exports = {
  clamp01, linear, power, sigmoid, taper, piecewise, normalise,
};
