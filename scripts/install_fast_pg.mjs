import { execSync } from 'child_process';
import net from 'net';

async function isPortOpen(port = 5432) {
  return new Promise((resolve) => {
    const s = net.createConnection({ port }, () => {
      s.end();
      resolve(true);
    });
    s.on('error', () => resolve(false));
  });
}

async function main() {
  console.log('=== Fast PostgreSQL Server Installation ===');
  const exe = 'C:\\Users\\asens\\AppData\\Local\\Temp\\chocolatey\\postgresql16\\16.15.4\\postgresql-16.15-4-windows-x64.exe';
  const args = [
    '--mode', 'unattended',
    '--enable-components', 'server,commandlinetools',
    '--disable-components', 'pgAdmin,stackbuilder',
    '--superpassword', 'postgres',
    '--serverport', '5432',
    '--unattendedmodeui', 'none'
  ].join(' ');

  console.log('Executing installer with pgAdmin excluded...');
  const cmd = `"${exe}" ${args}`;
  try {
    execSync(cmd, { stdio: 'inherit' });
    console.log('Installer command finished!');
  } catch (e) {
    console.log('Installer error:', e.message);
  }

  console.log('Checking port 5432...');
  for (let i = 0; i < 20; i++) {
    if (await isPortOpen(5432)) {
      console.log('SUCCESS: PostgreSQL is listening on port 5432!');
      break;
    }
    await new Promise(r => setTimeout(r, 1000));
  }
}

main().catch(console.error);
