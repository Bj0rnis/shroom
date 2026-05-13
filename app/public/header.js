// home-server Shroom — animated pixel-art header.
// Lives above the canvas, in the same visual family as the world below:
// source-resolution pixel art upscaled crisp, hyphae glow under it,
// two mushroom caps where the o's should be. Subtitle in IM Fell italic.
//
// Animations:
//   · on mount: the two mushroom caps "fruit up" from below baseline
//     over 1.1s with a small overshoot
//   · ambient: a faint hyphae-tip glow pulses under the word at ~3.6s
//   · hover: each cap emits a single spore that drifts up and fades
//
// Costs ~one rAF per frame while the page is open. Cheap.

const HDR_SRC_W = 96;     // source-resolution canvas width
const HDR_SRC_H = 22;     // source-resolution canvas height
const HDR_SCALE = 4;
const HDR_W = HDR_SRC_W * HDR_SCALE;
const HDR_H = HDR_SRC_H * HDR_SCALE;

// 6×8 pixel font. '1' = ink, '.' = transparent. Just the letters we need.
const PX_FONT = {
  S: [
    '.████.',
    '█....█',
    '█.....',
    '.████.',
    '.....█',
    '.....█',
    '█....█',
    '.████.',
  ],
  H: [
    '█....█',
    '█....█',
    '█....█',
    '██████',
    '█....█',
    '█....█',
    '█....█',
    '█....█',
  ],
  R: [
    '█████.',
    '█....█',
    '█....█',
    '█████.',
    '█.█...',
    '█..█..',
    '█...█.',
    '█....█',
  ],
  M: [
    '█....█',
    '██..██',
    '█.██.█',
    '█....█',
    '█....█',
    '█....█',
    '█....█',
    '█....█',
  ],
};
const LETTER_W = 6;
const LETTER_H = 8;
const LETTER_KERN = 1;            // px between letters at source res

// Two cap colours — same hues used in the locked palette for warm/cool.
const CAP_WARM = { hue: 12,  sat: 62 };
const CAP_COOL = { hue: 215, sat: 62 };

function _hslHdr(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function ShroomsHeader() {
  const ref = React.useRef(null);
  const mountTime = React.useRef(Date.now());
  const spores = React.useRef([]);   // {x, y, age, life, hue}
  const hovering = React.useRef(false);
  const lastSporeAt = React.useRef(0);

  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const A = window.ShroomAtoms;
    if (!A) return;
    let raf = 0;

    function draw() {
      const elapsed = Date.now() - mountTime.current;
      const pb = new A.PB(HDR_SRC_W, HDR_SRC_H);

      // Background — transparent (canvas is layered over the page bg).
      for (let i = 3; i < pb.data.length; i += 4) pb.data[i] = 0;

      // Letter layout: S H R [cap] [cap] M S — 5 letters + 2 caps slots.
      // Total source width = 5 * LETTER_W + 2 * CAP_SLOT_W + 6 * LETTER_KERN.
      const CAP_W = LETTER_W;        // same slot width as a letter
      const wordW = 7 * LETTER_W + 6 * LETTER_KERN;
      const wordX = Math.round((HDR_SRC_W - wordW) / 2);
      const wordY = 2;               // top padding
      const baseY = wordY + LETTER_H - 1;
      const ink   = _hslHdr(38, 14, 78);    // pale ink — matches stem colour
      const shade = _hslHdr(36, 18, 56);    // letter shadow

      // Draw the letter pixels (skip slots 3 & 4 — they're caps).
      const layout = ['S', 'H', 'R', null, null, 'M', 'S'];
      let cx = wordX;
      for (let li = 0; li < layout.length; li++) {
        const letter = layout[li];
        if (letter) {
          const rows = PX_FONT[letter];
          for (let py = 0; py < LETTER_H; py++) {
            const row = rows[py];
            for (let px = 0; px < LETTER_W; px++) {
              if (row[px] !== '.') {
                pb.set(cx + px, wordY + py, ink[0], ink[1], ink[2]);
                // 1-px right shadow for tiny depth
                if (px < LETTER_W - 1 && row[px + 1] === '.') {
                  pb.blend(cx + px + 1, wordY + py + 1, shade[0], shade[1], shade[2], 140);
                }
              }
            }
          }
        }
        cx += LETTER_W + LETTER_KERN;
      }

      // Two mushroom caps where the o's are. Source-res pixel art exactly
      // like the world, just smaller. Each cap fruits up from below.
      const capSlotX1 = wordX + 3 * (LETTER_W + LETTER_KERN);
      const capSlotX2 = wordX + 4 * (LETTER_W + LETTER_KERN);
      const fruitT = Math.min(1, elapsed / 1100);          // 0..1 over 1.1s
      const ease   = 1 - Math.pow(1 - fruitT, 3);          // ease-out cubic
      // Slight overshoot ~10% then settle.
      const overshoot = fruitT > 0.7 ? Math.sin((fruitT - 0.7) / 0.3 * Math.PI) * 0.1 : 0;
      const capY = baseY - Math.round(ease * 7) + Math.round(overshoot * 2);

      function drawCap(cxSlot, hueObj) {
        const r = 2;
        const light  = _hslHdr(hueObj.hue, hueObj.sat,      62);
        const mid    = _hslHdr(hueObj.hue, hueObj.sat,      48);
        const shadow = _hslHdr(hueObj.hue, hueObj.sat + 4,  32);
        const outln  = _hslHdr(hueObj.hue, hueObj.sat - 12, 18);
        const centerX = cxSlot + LETTER_W / 2 | 0;
        const cy = capY;
        for (let dy = -r; dy <= 0; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const d = Math.sqrt(dx * dx + dy * dy * 1.15);
            if (d > r) continue;
            let c;
            if (d > r - 1) c = outln;
            else if (dx < -r * 0.3 && dy < -r * 0.3) c = light;
            else if (dy > -1) c = shadow;
            else c = mid;
            pb.set(centerX + dx, cy + dy, c[0], c[1], c[2]);
          }
        }
        // Tiny stem (1px) descending to baseline.
        for (let sy = cy + 1; sy <= baseY; sy++) {
          pb.set(centerX, sy, ink[0], ink[1], ink[2]);
        }
        return { centerX, cy };
      }
      const capPos = [
        drawCap(capSlotX1, CAP_WARM),
        drawCap(capSlotX2, CAP_COOL),
      ];

      // Spore particles (top-layer additive — emitted on hover).
      const now = Date.now();
      // Advance + cull existing spores.
      spores.current = spores.current.filter(s => {
        s.age = (now - s.born) / s.life;
        return s.age < 1;
      });
      // Hover emission (rate-limited).
      if (hovering.current && (now - lastSporeAt.current) > 380) {
        lastSporeAt.current = now;
        spores.current.push(
          { x: capPos[0].centerX, y: capPos[0].cy - 2, born: now, life: 1400, hue: CAP_WARM.hue, age: 0 },
          { x: capPos[1].centerX, y: capPos[1].cy - 2, born: now, life: 1400, hue: CAP_COOL.hue, age: 0 },
        );
      }

      // ── put pixel buffer onto offscreen + crisp upscale ──
      const off = document.createElement('canvas');
      off.width = HDR_SRC_W; off.height = HDR_SRC_H;
      off.getContext('2d').putImageData(new ImageData(pb.data, HDR_SRC_W, HDR_SRC_H), 0, 0);

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, HDR_W, HDR_H);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, 0, 0, HDR_W, HDR_H);

      // ── hypha-tip glow pulse under the word (smoothed overlay) ──
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.globalCompositeOperation = 'lighter';
      const pulse = (Math.sin(elapsed / 1800) + 1) / 2;     // 0..1, ~3.6s cycle
      const alpha = 0.10 + pulse * 0.12;                    // 0.10..0.22
      const glowY = (baseY + 2) * HDR_SCALE;
      const glowGrad = ctx.createRadialGradient(
        HDR_W / 2, glowY, 0, HDR_W / 2, glowY, HDR_W * 0.45);
      glowGrad.addColorStop(0,   `rgba(255, 230, 170, ${alpha})`);
      glowGrad.addColorStop(0.5, `rgba(220, 140,  80, ${alpha * 0.5})`);
      glowGrad.addColorStop(1,   'rgba(220, 140, 80, 0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, HDR_W, HDR_H);

      // Spore overlay — drifting upward, fading.
      for (const s of spores.current) {
        const sx = s.x * HDR_SCALE + (s.age - 0.5) * 4;
        const sy = s.y * HDR_SCALE - s.age * 28;
        const r  = 2 + s.age * 6;
        const rgb = _hslHdr(s.hue, 70, 70);
        const a = (1 - s.age) * 0.42;
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
        g.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`);
        g.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      gap: 18, padding: '6px 0 8px',
    }}
      onMouseEnter={() => { hovering.current = true; }}
      onMouseLeave={() => { hovering.current = false; }}
    >
      <canvas ref={ref} width={HDR_W} height={HDR_H}
        style={{
          width: HDR_W / 2,
          height: HDR_H / 2,
          imageRendering: 'pixelated',
          display: 'block',
        }} />
      <div style={{
        fontFamily: '"IM Fell English", serif',
        fontStyle: 'italic',
        fontSize: 14,
        color: '#7a7060',
        letterSpacing: '0.04em',
        marginBottom: 4,
      }}>
        mycelium silentium
      </div>
    </div>
  );
}

window.ShroomsHeader = ShroomsHeader;
