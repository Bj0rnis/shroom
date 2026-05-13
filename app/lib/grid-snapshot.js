// Almari Shroom — packed grid snapshot for the canvas renderer.
// Kind/occupied/moisture as base64 typed arrays; everything else as JSON.
// Polled at ~1 Hz; payload is ~200 KB raw. Tight enough for local + Tailscale.

const { mutate } = require('./genome'); // no-op import to keep tree-shake honest

function packBytes(typedArr) {
  return Buffer.from(typedArr.buffer, typedArr.byteOffset, typedArr.byteLength).toString('base64');
}

function buildGridSnapshot(world) {
  const { kind, colony, moisture, age } = world.grid;

  // Compact "occupied" mask — clients only need to know whether a cell is
  // owned, not which colony (mushroom colour comes from the fruit's colonyId).
  const occupied = new Uint8Array(colony.length);
  for (let i = 0; i < colony.length; i++) occupied[i] = colony[i] === 0 ? 0 : 1;

  // Per-colony render palette — only the genes the renderer needs.
  const colonies = {};
  for (const c of Object.values(world.colonies)) {
    colonies[c.id] = {
      capHue:     c.genome[6],
      capShape:   Math.floor(c.genome[7]),
      capSize:    c.genome[8],
      stemLength: c.genome[9],
      name:       c.name || null,
      alive:      !!c.alive,
    };
  }

  return {
    meta: world.meta,
    shape: world.shape,
    kind:     packBytes(kind),
    occupied: packBytes(occupied),
    moisture: packBytes(moisture),
    spores:   world.spores.map(s => ({ x: s.x, y: s.y, age: s.age })),
    fruits:   world.fruits.filter(f => !f.spent).map(f => ({
      x: f.x, y: f.y, colonyId: f.colonyId, age: f.age, mature: f.mature,
    })),
    colonies,
    logBounds: world.meta.logBounds || null,
  };
}

module.exports = { buildGridSnapshot };
