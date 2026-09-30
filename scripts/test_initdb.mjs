import { execSync } from 'child_process';

const env = {
  ...process.env,
  PATH: `C:\\Program Files\\PostgreSQL\\16\\bin;${process.env.PATH}`
};

try {
  const out = execSync('initdb.exe --help', { env, encoding: 'utf8', timeout: 5000 });
  console.log('Success with PATH:', out.slice(0, 100));
} catch (e) {
  console.log('Error with PATH:', e.message, 'stderr:', e.stderr);
}
