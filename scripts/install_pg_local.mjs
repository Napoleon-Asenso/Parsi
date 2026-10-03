import { execSync } from 'child_process';
import path from 'path';

const exe = 'C:\\Users\\asens\\AppData\\Local\\Temp\\chocolatey\\postgresql16\\16.15.4\\postgresql-16.15-4-windows-x64.exe';
const targetDir = path.resolve('pgsql');

const args = [
  '--mode', 'unattended',
  '--unattendedmodeui', 'none',
  '--prefix', `"${targetDir}"`,
  '--datadir', `"${path.join(targetDir, 'data')}"`,
  '--enable-components', 'server,commandlinetools',
  '--disable-components', 'pgAdmin,stackbuilder',
  '--superpassword', 'postgres',
  '--serverport', '5432',
  '--create_shortcuts', '0'
].join(' ');

console.log('Running installer to target:', targetDir);
try {
  execSync(`"${exe}" ${args}`, { stdio: 'inherit' });
  console.log('Installer completed successfully!');
} catch (e) {
  console.error('Installer failed:', e.message);
}
