import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
import net from 'net';

const PG_BIN = 'C:\\Program Files\\PostgreSQL\\16\\bin';
const DATA_DIR = path.resolve('.pgdata');

const env = {
  ...process.env,
  PATH: `${PG_BIN};${process.env.PATH}`
};

async function isPortOpen(port = 5432) {
  return new Promise((resolve) => {
    const s = net.createConnection({ port }, () => {
      s.end();
      resolve(true);
    });
    s.on('error', () => resolve(false));
  });
}

async function run() {
  console.log('=== PostgreSQL Instant Setup ===');

  const portOpen = await isPortOpen(5432);
  console.log('Port 5432 already open:', portOpen);

  if (!portOpen) {
    if (!fs.existsSync(DATA_DIR)) {
      console.log('Initializing cluster at:', DATA_DIR);
      execSync(`initdb.exe -D "${DATA_DIR}" -U postgres -A trust -E UTF8 --no-locale`, {
        env,
        stdio: 'inherit'
      });
      console.log('Cluster initialized successfully!');
    } else {
      console.log('Data directory already exists at:', DATA_DIR);
    }

    console.log('Starting PostgreSQL server...');
    const logFile = path.resolve('.pgdata', 'server.log');
    execSync(`pg_ctl.exe -D "${DATA_DIR}" -l "${logFile}" start`, {
      env,
      stdio: 'inherit'
    });

    console.log('Waiting for port 5432...');
    let ready = false;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500));
      if (await isPortOpen(5432)) {
        ready = true;
        break;
      }
    }
    console.log('PostgreSQL ready on port 5432:', ready);
  }

  // Create database parsi_db if needed
  try {
    console.log('Ensuring parsi_db database exists...');
    execSync(`createdb.exe -U postgres -p 5432 parsi_db`, {
      env,
      stdio: 'inherit'
    });
    console.log('parsi_db database created!');
  } catch (e) {
    console.log('createdb note (likely already exists):', e.message);
  }

  console.log('=== PostgreSQL Instant Setup Complete ===');
}

run().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});
