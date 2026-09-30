import { execSync } from 'child_process';

const exe = 'C:\\Users\\asens\\AppData\\Local\\Temp\\chocolatey\\postgresql16\\16.15.4\\postgresql-16.15-4-windows-x64.exe';
try {
  const out = execSync(`"${exe}" --help`, { encoding: 'utf8' });
  console.log(out);
} catch (e) {
  console.log(e.message, e.stdout);
}
