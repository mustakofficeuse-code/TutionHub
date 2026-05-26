import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

async function generateImages() {
  const srcImage = path.join(process.cwd(), 'src', 'assets', 'images', 'gold_tuitionhub_logo_1779680854835.png');
  
  if (!fs.existsSync(srcImage)) {
    console.log('Source logo image does not exist, skipping image generation');
    return;
  }

  const publicDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  try {
    console.log('Generating high-quality PWA PNG assets from source...');
    
    // 192x192 PWA Icon
    await sharp(srcImage)
      .resize(192, 192)
      .png()
      .toFile(path.join(publicDir, 'gold_tuitionhub_logo_192.png'));
      
    // 512x512 PWA Icon
    await sharp(srcImage)
      .resize(512, 512)
      .png()
      .toFile(path.join(publicDir, 'gold_tuitionhub_logo_512.png'));

    // Default title log/shortcut icon
    await sharp(srcImage)
      .resize(512, 512)
      .png()
      .toFile(path.join(publicDir, 'gold_tuitionhub_logo_1779680854835.png'));

    // PWA Notification Badge (96x96)
    await sharp(srcImage)
      .resize(96, 96)
      .png()
      .toFile(path.join(publicDir, 'notification-badge.png'));

    console.log('PWA PNG assets successfully generated inside public/ folder!');
  } catch (err) {
    console.error('Error generating PWA images:', err);
  }
}

async function updateSW() {
  // Generate the PWA images first
  await generateImages();

  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (!fs.existsSync(configPath)) {
    console.log('No firebase config found, skipping SW update');
    return;
  }
  
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const swPath = path.join(process.cwd(), 'public', 'firebase-messaging-sw.js');
  
  if (!fs.existsSync(swPath)) return;
  
  let swContent = fs.readFileSync(swPath, 'utf8');
  
  // Replace the hardcoded firebase.initializeApp block
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

await updateSW();

