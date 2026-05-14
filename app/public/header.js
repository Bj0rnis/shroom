// Almari Shroom — animated pixel-art hero.
// 320×60 source at SCALE=2 → 640×120px, centered in a full-width dark band.

function ShroomsHeader() {
  const SRC_W = 320, SRC_H = 60, SCALE = 2;
  return (
    <div style={{
      width: '100%',
      background: '#0a0908',
      display: 'flex',
      justifyContent: 'center',
      padding: '6px 0',
      border: '1px solid #1f1c17',
      overflow: 'hidden',
    }}>
      {window.SHROOM && window.SHROOM.ShroomHero ? (
        <window.SHROOM.ShroomHero srcW={SRC_W} srcH={SRC_H} scale={SCALE} />
      ) : (
        <div style={{
          width: SRC_W * SCALE, height: SRC_H * SCALE,
          color: '#7a7060', fontFamily: '"IBM Plex Mono", monospace', fontSize: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>awakening…</div>
      )}
    </div>
  );
}

window.ShroomsHeader = ShroomsHeader;
