fetch('http://localhost:3000/api/admin/clear-fees', { method: 'POST' })
  .then(res => res.json())
  .then(data => { console.log(data); process.exit(0); })
  .catch(err => { console.error(err); process.exit(1); });
