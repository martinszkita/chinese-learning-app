const { readdirSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
for (const file of readdirSync(path.join(__dirname, '../tests')).filter(file => file.endsWith('.cjs')).sort()) {
  const result = spawnSync(process.execPath, [path.join(__dirname, '../tests', file)], { stdio:'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
