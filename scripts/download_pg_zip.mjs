import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const get = url.startsWith('https') ? https.get : http.get;
    
    get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        console.log('Redirecting to:', response.headers.location);
        file.close();
        fs.unlinkSync(dest);
        return resolve(downloadFile(response.headers.location, dest));
      }
      if (response.statusCode !== 200) {
        return reject(new Error(`Failed with status ${response.statusCode}`));
      }
      const total = parseInt(response.headers['content-length'] || '0', 10);
      let downloaded = 0;
      let lastPct = 0;

      response.on('data', (chunk) => {
        downloaded += chunk.length;
        if (total > 0) {
          const pct = Math.floor((downloaded / total) * 100);
          if (pct >= lastPct + 20) {
            console.log(`Download progress: ${pct}% (${(downloaded / 1024 / 1024).toFixed(1)} MB)`);
            lastPct = pct;
          }
        }
      });

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Download complete! Total: ${(downloaded / 1024 / 1024).toFixed(1)} MB`);
        resolve(dest);
      });
    }).on('error', (err) => {
      fs.unlinkSync(dest);
      reject(err);
    });
  });
}

const dest = path.resolve('postgresql-16-binaries.zip');
downloadFile('https://sbp.enterprisedb.com/getfile.jsp?fileid=1259297', dest)
  .then(() => console.log('Saved to:', dest))
  .catch(console.error);
