import fs from 'fs';
import net from 'net';

async function checkPort() {
  return new Promise((resolve) => {
    const s = net.createConnection({ port: 5432 }, () => {
      s.end();
      resolve(true);
    });
    s.on('error', () => resolve(false));
  });
}

async function main() {
  const portOpen = await checkPort();
  console.log('Port 5432 open:', portOpen);

  const dataExists = fs.existsSync('C:\\Program Files\\PostgreSQL\\16\\data');
  console.log('C:\\Program Files\\PostgreSQL\\16\\data exists:', dataExists);

  try {
    const log = fs.readFileSync('C:\\Users\\asens\\AppData\\Local\\Temp\\installbuilder_installer_13280.log', 'utf8');
    const lines = log.trim().split('\n');
    console.log('Installer log total lines:', lines.length);
    console.log('Last 3 lines:');
    console.log(lines.slice(-3).join('\n'));
  } catch (e) {
    console.log('Installer log error:', e.message);
  }
}

main();
