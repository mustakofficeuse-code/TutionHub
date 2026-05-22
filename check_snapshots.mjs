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

files.forEach((file) => {
  let content = fs.readFileSync(file, 'utf8');
  // Check if it calls onSnapshot without an error handler
  // Typically, an error handler is the 3rd argument, or the second argument if query vs doc.
  // Actually, standard `onSnapshot(query, (snap) => { ... })` has 2 args. 
  // If no error handler, it looks like `onSnapshot(xyz, (snap) => { ... });` or equivalent.
  // A simple heuristic: count `onSnapshot(` vs occurrences of `(e` or `(err` or `,{` or `, (` or `,(e:` inside the file.
  
  if (content.includes('onSnapshot')) {
    console.log(`Checking ${file}`);
  }
});
