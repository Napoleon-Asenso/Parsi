import fs from 'fs';
import path from 'path';

const tempDir = 'C:\\Users\\asens\\AppData\\Local\\Temp';
const files = fs.readdirSync(tempDir)
  .filter(f => f.startsWith('installbuilder_installer_') && f.endsWith('.log'))
  .map(f => ({ name: f, time: fs.statSync(path.join(tempDir, f)).mtimeMs }))
  .sort((a, b) => b.time - a.time);

console.log('Found installer logs:', files.slice(0, 3));
if (files.length > 0) {
  const latest = path.join(tempDir, files[0].name);
  const content = fs.readFileSync(latest, 'utf8');
  const lines = content.trim().split('\n');
  console.log(`Latest log (${files[0].name}) total lines:`, lines.length);
  console.log('Last 5 lines:');
  console.log(lines.slice(-5).join('\n'));
}
