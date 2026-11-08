// Embedded PostgreSQL controller for local development.
// Usage: node scripts/db.mjs [start|stop|status]
// In production, set DATABASE_URL to a managed PostgreSQL instance instead.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(root, 'node_modules', '@embedded-postgres', 'windows-x64', 'native', 'bin');
const DATA = path.join(root, '.pgdata');
const LOG = path.join(root, '.pgdata.log');
const PORT = process.env.PGPORT || '5433';

function run(exe, args, opts = {}) {
  return execFileSync(path.join(BIN, exe), args, { stdio: 'inherit', ...opts });
}

function isRunning() {
  try {
    execFileSync(path.join(BIN, 'pg_ctl.exe'), ['status', '-D', DATA], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

const cmd = process.argv[2] || 'start';

if (cmd === 'start') {
  if (!existsSync(path.join(DATA, 'PG_VERSION'))) {
    console.log('Initializing database cluster...');
    run('initdb.exe', ['-D', DATA, '-U', 'postgres', '-A', 'trust', '-E', 'UTF8', '--no-instructions']);
  }
  if (isRunning()) {
    console.log(`PostgreSQL already running on port ${PORT}.`);
  } else {
    run('pg_ctl.exe', ['-D', DATA, '-o', `-p ${PORT}`, '-l', LOG, '-w', 'start']);
    console.log(`PostgreSQL started on port ${PORT}.`);
  }
} else if (cmd === 'stop') {
  run('pg_ctl.exe', ['-D', DATA, '-m', 'fast', 'stop']);
} else if (cmd === 'status') {
  console.log(isRunning() ? 'running' : 'stopped');
} else {
  console.error(`Unknown command: ${cmd}`);
  process.exit(1);
}
