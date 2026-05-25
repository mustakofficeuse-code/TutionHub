import fs from 'fs';
import path from 'path';

function updateSW() {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (!fs.existsSync(configPath)) {
    console.log('No firebase config found, skipping SW update');
    return;
  }
  
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const swPath = path.join(process.cwd(), 'public', 'firebase-messaging-sw.js');
  
  if (!fs.existsSync(swPath)) return;
  
  let swContent = fs.readFileSync(swPath, 'utf8');
  
  // Replace the hardcoded firebase.initializeApp bloc
  const newInit = `firebase.initializeApp({
  apiKey: "${config.apiKey}",
  authDomain: "${config.authDomain}",
  projectId: "${config.projectId}",
  storageBucket: "${config.storageBucket}",
  messagingSenderId: "${config.messagingSenderId}",
  appId: "${config.appId}"
});`;
  
  swContent = swContent.replace(/firebase\.initializeApp\(\{[\s\S]*?\}\);/, newInit);
  
  fs.writeFileSync(swPath, swContent);
  console.log('Service Worker updated with current Firebase config');
}

updateSW();
