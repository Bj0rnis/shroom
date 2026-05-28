#!/usr/bin/env node
// CLI entry: node app/cli/lab.js <configId> [--label "iteration tag"]
//
// Runs the config's vision target across its seed set, prints the report.
// Output is markdown; pipe to a file (e.g. `> /tmp/lab.md`) or paste into
// a NOTES.md entry.

const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const configId = args[0];
if (!configId) {
  console.error('usage: node app/cli/lab.js <configId> [--label "tag"]');
  console.error('example: node app/cli/lab.js baseline --label "before age-decay"');
  process.exit(1);
}
let label = null;
const lbIdx = args.indexOf('--label');
if (lbIdx >= 0) label = args[lbIdx + 1] || null;
let durationDays = null;
const dyIdx = args.indexOf('--days');
if (dyIdx >= 0) durationDays = parseFloat(args[dyIdx + 1]);

const configPath = path.resolve(__dirname, '../lib/sim-lab/configs', `${configId}.js`);
if (!fs.existsSync(configPath)) {
  console.error(`config not found: ${configPath}`);
  process.exit(1);
}

// Send lab persistence to a scratch dir so configs don't pollute the
// live data dir. Override with DATA_DIR if you want the runs archived.
process.env.DATA_DIR = process.env.DATA_DIR || '/tmp/shroom-lab-scratch';
fs.mkdirSync(process.env.DATA_DIR, { recursive: true });

const config = require(configPath);
const { runVisionTarget } = require('../lib/sim-lab/driver');
const { renderReport }    = require('../lib/sim-lab/report');

(async () => {
  const outcome = await runVisionTarget(config.vision, { seeds: config.seeds, durationDays });
  process.stdout.write(renderReport(outcome, { label }));
})().catch(e => { console.error(e.stack || e); process.exit(1); });
