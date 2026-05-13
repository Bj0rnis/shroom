// Almari Shroom — packed grid snapshot for the canvas renderer.
// Kind/occupied/moisture as base64 typed arrays; everything else as JSON.
// Polled at ~1 Hz; payload is ~200 KB raw. Tight enough for local + Tailscale.

const { mutate } = require('./genome'); // no-op import to keep tree-shake honest

function packBytes(typedArr) {
  return Buffer.from(typedArr.buffer, typedArr.byteOffset, typedArr.byteLength).toString('base64');
}

function buildGridSnapshot(world) {
  const { kind, colony, moisture, age } = world.grid;
  const [W, H] = world.shape;

  // Compact "occupied" mask — clients only need to know whether a cell is
  // owned, not which colony (mushroom colour comes from the fruit's colonyId).
  const occupied = new Uint8Array(colony.length);
  for (let i = 0; i < colony.length; i++) occupied[i] = colony[i] === 0 ? 0 : 1;

  // Per-colony bbox + cell count. The new renderer paints hyphae as a
  // painterly walker bounded by the colony's actual footprint (option B
  // from the kit critique). Computed once per tick from the colony grid
  // instead of shipping the full Uint16Array per frame.
  const bboxes = {};                // id -> {minX, minY, maxX, maxY, count}
  for (let i = 0; i < colony.length; i++) {
    const id = colony[i];
    if (!id) continue;
    const x = i % W, y = (i / W) | 0;
    let b = bboxes[id];
    if (!b) {
      bboxes[id] = { minX: x, minY: y, maxX: x, maxY: y, count: 1 };
    } else {
      if (x < b.minX) b.minX = x;
      else if (x > b.maxX) b.maxX = x;
      if (y < b.minY) b.minY = y;
      else if (y > b.maxY) b.maxY = y;
      b.count++;
    }
  }

  // Per-colony render palette — only the genes the renderer needs, plus the
  // computed bbox/count so option-B hyphae has its bounds without a full
  // colony grid in the payload.
  const colonies = {};
  for (const c of Object.values(world.colonies)) {
    const b = bboxes[c.id];
    colonies[c.id] = {
      capHue:     c.genome[6],
      capShape:   Math.floor(c.genome[7]),
      capSize:    c.genome[8],
      stemLength: c.genome[9],
      name:       c.name || null,
      alive:      !!c.alive,
      bbox:       b ? { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY } : null,
      cellCount:  b ? b.count : 0,
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
    logs:      world.meta.logs || (world.meta.logBounds ? [{
      id: 1,
      x0: world.meta.logBounds.x0,
      y0: world.meta.logBounds.y0,
      w:  world.meta.logBounds.w,
      h:  world.meta.logBounds.h,
      species: 'oak', foundedTick: 0, mossy: false,
    }] : []),
    eraScars:  world.meta.eraScars || [],   // slice 4 populates this
    logBounds: world.meta.logBounds || null, // back-compat for any older client
  };
}

module.exports = { buildGridSnapshot };
