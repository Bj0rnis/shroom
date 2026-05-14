// Almari Shroom — DarkPanel: pixel-art dark surface that fills its container.
// Backed by PIX.panel() (paintDark + 1px ink border + corner notches) via
// ResizeObserver-driven PixelStage. Same pattern as Chronicle's ParchmentBg.
//
// Children must have position: relative (or any non-static position) to appear
// above the canvas layer. Both status.js and dev-dashboard.js do this.

(function () {
  const { useRef, useState, useLayoutEffect } = React;

  function DarkPanel({ children, style, seed = 3, onClick }) {
    const wrapRef = useRef(null);
    const [dim, setDim] = useState({ w: 80, h: 40 });

    useLayoutEffect(() => {
      const el = wrapRef.current; if (!el) return;
      const SCALE = 3;
      const ro = new ResizeObserver(([entry]) => {
        const { width, height } = entry.contentRect;
        setDim({
          w: Math.max(20, Math.floor(width / SCALE)),
          h: Math.max(10, Math.floor(height / SCALE)),
        });
      });
      ro.observe(el);
      return () => ro.disconnect();
    }, []);

    const PIX = window.PIX;
    return (
      <div style={{ position: 'relative', ...style }} onClick={onClick}>
        <div ref={wrapRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          {PIX && (
            <PIX.PixelStage
              w={dim.w} h={dim.h} scale={1}
              deps={[dim.w, dim.h]}
              draw={(pb) => PIX.panel(pb, 0, 0, dim.w, dim.h, { surface: 'dark', seed })}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            />
          )}
        </div>
        {children}
      </div>
    );
  }

  window.DarkPanel = DarkPanel;
})();
