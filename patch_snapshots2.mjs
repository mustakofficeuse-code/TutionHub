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

  // Let's replace any `}, (error) => {` that we might have missed? No.
  // This finds `onSnapshot(..., (snap) => { ... })` and adds the error handler
  // It's a bit tricky because of nested parentheses and braces.
  
  // A simple hack strategy: replace all `});` with `}, (e: any) => {});` if they are followed by `const unsub`
  
  const rules = [
    { find: /    \}\);\n    const unsub/g, repl: "    }, (e: any) => { /* ignore */ });\n    const unsub" },
    { find: /    \}\);\n\n    return \(\) =>/g, repl: "    }, (e: any) => { /* ignore */ });\n\n    return () =>" },
    { find: /    \}\);\n  }, \[\]\);/g, repl: "    }, (e: any) => { /* ignore */ });\n  }, []);" },
    { find: /    \}\);\n  }, \[profile\]\);/g, repl: "    }, (e: any) => { /* ignore */ });\n  }, [profile]);" }
  ];

  for (const r of rules) {
    // Basic verification: only apply if the file imports onSnapshot
    if (content.includes('onSnapshot') && content.match(r.find)) {
      content = content.replace(r.find, r.repl);
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(file, content);
    modifiedFiles++;
    console.log(`Patched ${file}`);
  }
});
console.log(`Patched ${modifiedFiles} files`);
