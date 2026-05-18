// Renders a vision-run report as markdown. Compact, scannable, embeds the
// ASCII for the median run. Includes a sparkline-ish summary for each scorer.

function renderReport(runOutcome, opts = {}) {
  const { vision, seeds, results, aggregate } = runOutcome;
  const lines = [];

  lines.push(`# ${vision.id} — ${vision.scenarioId}`);
  lines.push('');
  lines.push(`_${vision.description}_`);
  lines.push('');
  lines.push(`**seeds**: ${seeds.join(', ')}  ·  **scorers**: ${vision.scorers.length}`);
  if (opts.label) lines.push(`**run label**: ${opts.label}`);
  lines.push('');

  // Per-target pass-rate table
  lines.push('## targets across seeds');
  lines.push('');
  lines.push('| target | pass | min | median | max |');
  lines.push('|--------|------|-----|--------|-----|');
  for (const s of vision.scorers) {
    const a = aggregate[s.name];
    const pass = `${a.passCount}/${seeds.length}`;
    lines.push(`| ${s.name} | ${pass} | ${fmt(a.min)} | ${fmt(a.median)} | ${fmt(a.max)} |`);
  }
  lines.push('');

  // Per-seed brief
  lines.push('## per-seed');
  lines.push('');
  lines.push('| seed | cells | maxCol | alive | passed |');
  lines.push('|------|-------|--------|-------|--------|');
  for (const r of results) {
    lines.push(`| ${r.seed} | ${r.hyphaeCells} | ${r.maxColonyCells} | ${r.coloniesAlive} | ${r.passedTargets}/${r.totalTargets} |`);
  }
  lines.push('');

  // Median-passing run's ASCII (or first if none passed)
  const sortedByPass = [...results].sort((a, b) => b.passedTargets - a.passedTargets);
  const showcase = sortedByPass[Math.floor(sortedByPass.length / 2)] || results[0];
  if (showcase) {
    lines.push(`## final shape — seed ${showcase.seed} (${showcase.passedTargets}/${showcase.totalTargets} targets)`);
    lines.push('```');
    lines.push(showcase.ascii);
    lines.push('```');
    lines.push('');
    lines.push('### scorer detail (this seed)');
    for (const s of showcase.scores) {
      const mark = s.ok ? '✓' : '✗';
      lines.push(`- ${mark} **${s.name}** — ${s.note}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function fmt(v) {
  if (typeof v !== 'number') return String(v);
  if (Math.abs(v) >= 100 || Number.isInteger(v)) return v.toString();
  return v.toFixed(3);
}

module.exports = { renderReport };
