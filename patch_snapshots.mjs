import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) { 
      results.push(file);
    }
  });
  return results;
}

const files = walk('./src');
let modifiedFiles = 0;

files.forEach((file) => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  
  const regex1 = /    \}\);\n    const unsub/g;
  if (content.match(regex1)) {
    content = content.replace(regex1, "    }, (e: any) => { /* ignore perm errors on logout */ });\n    const unsub");
    changed = true;
  }

  const regex2 = /    \}\);\n  \}, \[/g;
  // Dangerous unless we know it's an onSnapshot
  // Let's do it manually for TeacherDashboard, StudentHome, AuthGateway
  if (changed) {
    fs.writeFileSync(file, content);
    modifiedFiles++;
    console.log(`Patched ${file}`);
  }
});
console.log(`Patched ${modifiedFiles} files`);
