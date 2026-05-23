// Minimal markdown → HTML for the journal pages. Handles the subset used
// in NOTES.md / RESEARCH.md: headings, paragraphs, bold/italic, inline +
// fenced code, lists, tables, hr, links. No deps, no DOM, no rich parsing.
//
// Tradeoff: NOT a full CommonMark renderer. If a journal entry needs a
// markdown feature this doesn't handle, render output will degrade. That's
// fine — the source markdown is still authoritative; HTML is a view on it.

function escape(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(s) {
  // Escape first, then re-introduce inline markup as HTML.
  let out = escape(s);
  // Inline code (before bold/italic so they don't eat backticks).
  out = out.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[\s(])_([^_]+)_(?=[\s.,;:!?)]|$)/g, '$1<em>$2</em>');
  out = out.replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s.,;:!?)]|$)/g, '$1<em>$2</em>');
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return out;
}

function renderMarkdown(md) {
  const lines = md.split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (/^```/.test(line)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      out.push(`<pre><code>${escape(buf.join('\n'))}</code></pre>`);
      continue;
    }

    // Headings
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line)) { out.push('<hr/>'); i++; continue; }

    // Table — detect a header row followed by a separator row of dashes.
    if (line.includes('|') && /\|/.test(lines[i + 1] || '') && /^\s*\|?\s*:?-+/.test(lines[i + 1] || '')) {
      const cells = (s) => s.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(c => c.trim());
      const head = cells(line);
      i += 2;
      const body = [];
      while (i < lines.length && lines[i].includes('|')) { body.push(cells(lines[i])); i++; }
      const thead = `<thead><tr>${head.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${body.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
      out.push(`<table>${thead}${tbody}</table>`);
      continue;
    }

    // Lists
    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^[-*]\s+/, ''))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    // Blank line → just skip
    if (!line.trim()) { i++; continue; }

    // Paragraph: collect non-blank, non-special lines
    const buf = [line];
    i++;
    while (i < lines.length && lines[i].trim() &&
           !/^(#{1,6}\s|```|---|[-*]\s|\|)/.test(lines[i])) {
      buf.push(lines[i]); i++;
    }
    out.push(`<p>${inline(buf.join(' '))}</p>`);
  }

  return out.join('\n');
}

function renderPage(title, md) {
  const body = renderMarkdown(md);
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<title>${escape(title)} · shroom · lab</title>
<style>
  :root { --bg:#0f1014; --fg:#d8d2c4; --dim:#7c7766; --hi:#e8c98a; --hypha:#9dc488;
          --line:#2a2622; --code:#1a1a1f; --mono: ui-monospace, 'SF Mono', Consolas, monospace; }
  * { box-sizing: border-box }
  body { background: var(--bg); color: var(--fg); font: 16px/1.55 ui-serif, 'New York', Cambria, serif;
         margin: 0; padding: 32px 16px 80px; }
  main { max-width: 820px; margin: 0 auto; }
  h1, h2, h3, h4 { font-family: var(--mono); color: var(--hi); letter-spacing: 0.02em; }
  h1 { font-size: 28px; border-bottom: 1px solid var(--line); padding-bottom: 8px; margin-top: 0; }
  h2 { font-size: 18px; margin-top: 32px; color: var(--hypha); }
  h3 { font-size: 14px; margin-top: 22px; color: var(--fg); text-transform: uppercase; }
  p { color: var(--fg); }
  a { color: var(--hi); }
  hr { border: none; border-top: 1px solid var(--line); margin: 32px 0; }
  code { font-family: var(--mono); background: var(--code); padding: 1px 5px; border-radius: 3px;
         font-size: 13px; color: var(--hi); }
  pre { background: var(--code); padding: 12px; border-radius: 4px; overflow-x: auto;
        border: 1px solid var(--line); }
  pre code { background: none; padding: 0; font-size: 11px; line-height: 1.3; color: var(--fg); white-space: pre; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-family: var(--mono); font-size: 13px; }
  th, td { padding: 6px 10px; border-bottom: 1px solid var(--line); text-align: left; }
  th { color: var(--hypha); font-weight: normal; }
  ul { padding-left: 22px; }
  li { margin: 4px 0; }
  em { color: var(--dim); font-style: italic; }
  strong { color: var(--hi); font-weight: 600; }
  .nav { font-family: var(--mono); font-size: 12px; color: var(--dim); margin-bottom: 24px;
         text-transform: uppercase; letter-spacing: 0.2em; }
  .nav a { color: var(--dim); text-decoration: none; margin-right: 16px; }
  .nav a:hover { color: var(--hi); }
</style>
</head><body><main>
<div class="nav"><a href="/research">research</a><a href="/research/paper">paper</a><a href="/notes">notes</a><a href="/process">process</a><a href="/">live</a></div>
${body}
</main></body></html>`;
}

module.exports = { renderMarkdown, renderPage };
