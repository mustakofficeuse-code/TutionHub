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

  const rules = [
    { find: /    \}\);\n\n    \/\/ We/g, repl: "    }, (e: any) => { /* ignore */ });\n\n    // We" },
    { find: /    \);\n\n    const unsubActiveSchedules/g, repl: "    }, (e: any) => { /* ignore */ });\n\n    const unsubActiveSchedules" },
    { find: /    \);\n    const unsub/g, repl: "    }, (e: any) => { /* ignore */ });\n    const unsub" },
    { find: /    \);\n  useEffect/g, repl: "    }, (e: any) => { /* ignore */ });\n  useEffect" }
  ];

  for (const r of rules) {
    if (content.includes('onSnapshot') && content.match(r.find)) {
      content = content.replace(r.find, r.repl);
      changed = true;
    }
  }

  // Also manually target Home.tsx since it has specific end formats.
  if (file.includes('Home.tsx')) {
    // `      }\n    );` to `      }\n    }, (e:any)=>{});`
    content = content.replace(/      \}\n    \);\n/g, "      }\n    }, (e:any)=>{});\n");
    changed = true;
  }
  
  if (file.includes('Dashboard.tsx')) {
    content = content.replace(/    \);\n    const unsub/g, "    }, (e:any)=>{});\n    const unsub");
    content = content.replace(/    \}\);\n    const unsub/g, "    }, (e:any)=>{});\n    const unsub");
    content = content.replace(/    \);\n  \}, \[/g, "    }, (e:any)=>{});\n  }, [");
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content);
    modifiedFiles++;
    console.log(`Patched ${file}`);
  }
});
console.log(`Patched ${modifiedFiles} files`);
