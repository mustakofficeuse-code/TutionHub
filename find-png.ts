import fs from 'fs';
import path from 'path';

function findPngs(dir: string) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (file === 'node_modules' || file === '.git' || file === 'dist') continue;
    
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      findPngs(fullPath);
    } else if (file.endsWith('.png')) {
      console.log(`PNG Found: ${fullPath} (size: ${stat.size} bytes, mtime: ${stat.mtime})`);
    }
  }
}

findPngs(process.cwd());
