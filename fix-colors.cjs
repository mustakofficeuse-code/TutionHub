const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
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
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  // Regex to replace class names if they don't already have their dark mode counterpart in the same file
  // A better approach is to replace it globally, but we might duplicate if it's already there.
  // Let's just do simple string replacement for common patterns.
  
  content = content.replace(/text-slate-900(?!\s+dark:text-white)/g, 'text-slate-900 dark:text-white');
  content = content.replace(/bg-white(?!\s+dark:bg-slate-900)(?!\s+dark:bg-slate-800)(?!\/)/g, 'bg-white dark:bg-slate-900');
  content = content.replace(/border-slate-100(?!\s+dark:border-slate-800)/g, 'border-slate-100 dark:border-slate-800');
  content = content.replace(/text-slate-500(?!\s+dark:text-slate-400)/g, 'text-slate-500 dark:text-slate-400');
  content = content.replace(/bg-slate-50(?!\s+dark:bg-slate-950)(?!\s+dark:bg-slate-800)(?!\/)/g, 'bg-slate-50 dark:bg-slate-950');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed', file);
  }
});
