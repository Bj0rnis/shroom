// Fire-and-forget reporter — POSTs LLM usage to the dashboard's
// /api/ai-usage collector. Silent on failure: the sim and Nigehban must
// keep running even when the dashboard or network is unreachable.
//
// Required env:
//   DASHBOARD_URL    e.g. http://dashboard:3000   (compose-network hostname)
//   AI_USAGE_TOKEN   shared bearer token, also set on the dashboard side
//
// Without those env vars, report() becomes a no-op — useful in dev.

const fetch = require('node-fetch');

const URL   = process.env.DASHBOARD_URL ? `${process.env.DASHBOARD_URL.replace(/\/$/, '')}/api/ai-usage` : null;
const TOKEN = process.env.AI_USAGE_TOKEN || null;

function report(usage) {
  if (!URL || !TOKEN) return;
  // Don't await — fire-and-forget.
  fetch(URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(usage),
    timeout: 3000,
  }).catch(() => { /* swallow */ });
}

module.exports = { report };
