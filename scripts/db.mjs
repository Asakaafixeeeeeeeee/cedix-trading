// Embedded PostgreSQL controller for local development.
// Usage: node scripts/db.mjs [start|stop|status]
// Data lives OUTSIDE the project folder so the Next.js dev watcher is not
// triggered by database writes. In production, set DATABASE_URL to a managed
// PostgreSQL instance instead.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(root, 'node_modules', '@embedded-postgres', 'windows-x64', 'native', 'bin');
const BASE = process.env.CEDIX_PGDIR || path.join(os.homedir(), '.cedix');
const DATA = path.join(BASE, 'pgdata');
const LOG = path.join(BASE, 'pg.log');
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
    console.log(`Initializing database cluster at ${DATA}...`);
    run('initdb.exe', ['-D', DATA, '-U', 'postgres', '-A', 'trust', '-E', 'UTF8', '--no-instructions']);
  }
  if (isRunning()) {
    console.log(`PostgreSQL already running on port ${PORT}.`);
  } else {
    run('pg_ctl.exe', ['-D', DATA, '-o', `-p ${PORT}`, '-l', LOG, '-w', 'start']);
    console.log(`PostgreSQL started on port ${PORT} (data: ${DATA}).`);
  }
} else if (cmd === 'stop') {
  run('pg_ctl.exe', ['-D', DATA, '-m', 'fast', 'stop']);
} else if (cmd === 'status') {
  console.log(isRunning() ? 'running' : 'stopped');
} else {
  console.error(`Unknown command: ${cmd}`);
  process.exit(1);
}
