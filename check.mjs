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
  let matchCount = (content.match(/onSnapshot\(/g) || []).length;
  if(matchCount === 0) return;
  // Let's count error handlers
  // To identify them, we look for `, (` followed by error arg at the end.
  // Actually, simplest is to see if any `onSnapshot` doesn't have an arrow function error handler `(e` or `(err` or `,{` or `, (` or `,(e:` after the success handler
  // Since we already used my patch script, let's trace manually.
  
  // Just print the file if it has onSnapshot
  let numUnsub = (content.match(/const unsub.*? = onSnapshot\(/g) || []).length;
  let numVoid = (content.match(/return onSnapshot\(/g) || []).length;
  let numUnassigned = (content.match(/^[\s]*onSnapshot\(/gm) || []).length;
  
  // Actually, we can count how many '}, (e: any) => {' or '}, (err' or '}, (e' or 'logError' there are
  
  let numErrHandlers = (content.match(/\},[\s]*\([a-zA-Z0-9_\s:]*\)[\s]*=>/g) || []).length;
  
  console.log(`${file}: calls=${matchCount}, unsubs=${numUnsub}, error_handlers_approx=${numErrHandlers}`);
});
