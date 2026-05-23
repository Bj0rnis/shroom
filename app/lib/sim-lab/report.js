// Renders a vision-run report as markdown. Compact, scannable, embeds the
// ASCII for the median run. Includes a sparkline-ish summary for each scorer.
//
// opts.prior — a previous runOutcome from the same vision. When present,
// the targets table shows delta columns (∆pass, ∆median) so the agent
// can see at a glance whether the iteration moved the needle.

function renderReport(runOutcome, opts = {}) {
  const { vision, seeds, results, aggregate } = runOutcome;
  const prior = opts.prior;
  const lines = [];

  lines.push(`# ${vision.id} — ${vision.scenarioId}`);
  lines.push('');
  lines.push(`_${vision.description}_`);
  lines.push('');
  lines.push(`**seeds**: ${seeds.join(', ')}  ·  **scorers**: ${vision.scorers.length}`);
  if (opts.label) lines.push(`**run label**: ${opts.label}`);
  if (prior && opts.priorLabel) lines.push(`**compared against**: ${opts.priorLabel}`);
  lines.push('');

  // Per-target pass-rate table (with deltas vs prior if provided)
  lines.push('## targets across seeds');
  lines.push('');
  if (prior) {
    lines.push('| target | pass | ∆pass | min | median | ∆median | max |');
    lines.push('|--------|------|-------|-----|--------|---------|-----|');
  } else {
    lines.push('| target | pass | min | median | max |');
    lines.push('|--------|------|-----|--------|-----|');
  }
  for (const s of vision.scorers) {
    const a = aggregate[s.name];
    const pass = `${a.passCount}/${seeds.length}`;
    if (prior) {
      const pa = prior.aggregate[s.name];
      const dPass = pa ? signed(a.passCount - pa.passCount) : 'new';
      const dMed  = pa ? signedNum(a.median - pa.median) : 'new';
      lines.push(`| ${s.name} | ${pass} | ${dPass} | ${fmt(a.min)} | ${fmt(a.median)} | ${dMed} | ${fmt(a.max)} |`);
    } else {
      lines.push(`| ${s.name} | ${pass} | ${fmt(a.min)} | ${fmt(a.median)} | ${fmt(a.max)} |`);
    }
  }
  lines.push('');

  // Per-seed brief — seed-tag column groups by regime
  lines.push('## per-seed');
  lines.push('');
  lines.push('| seed | regime | cells | maxCol | alive | passed |');
  lines.push('|------|--------|-------|--------|-------|--------|');
  for (const r of results) {
    lines.push(`| ${r.seed} | ${r.tag || '—'} | ${r.hyphaeCells} | ${r.maxColonyCells} | ${r.coloniesAlive} | ${r.passedTargets}/${r.totalTargets} |`);
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

function signed(n) {
  if (n === 0) return '·';
  return n > 0 ? `+${n}` : `${n}`;
}

function signedNum(n) {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) < 1e-9) return '·';
  const formatted = Math.abs(n) >= 100 || Number.isInteger(n) ? n.toString() : n.toFixed(3);
  return n > 0 ? `+${formatted}` : formatted;
}

module.exports = { renderReport };
