// Run from any directory: node /path/to/event-system/setup.cjs
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

process.chdir(__dirname);
if (Number(process.versions.node.split('.')[0]) < 20) {
  console.error('Node.js 20+ is required. Install Node.js 22, then run this again.');
  process.exit(1);
}
if (!fs.existsSync('.env')) {
  fs.copyFileSync(path.join(__dirname, '.env.example'), path.join(__dirname, '.env'));
  console.log('Created .env with demo settings.');
}
console.log('Installing dependencies from package-lock.json...');
const install = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm',
  ['ci', '--omit=dev'], { stdio: 'inherit', shell: process.platform === 'win32' });
if (install.error || install.status !== 0) {
  console.error(install.error?.message || 'Dependency installation failed. See REQUIREMENTS.md for help.');
  process.exit(install.status || 1);
}
console.log('Starting project. Open http://localhost:3000 (or the PORT in .env). Ctrl+C to stop.');
const server = spawnSync(process.execPath, ['server.js'], { stdio: 'inherit' });
if (server.error) console.error(server.error.message);
process.exit(server.status ?? 1);
