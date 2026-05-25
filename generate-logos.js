import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

async function generate() {
  const logoPath = path.join(process.cwd(), 'public', 'logo.png');
  const size192Path = path.join(process.cwd(), 'public', 'logo-192.png');
  const size512Path = path.join(process.cwd(), 'public', 'logo-512.png');

  if (!fs.existsSync(logoPath)) {
    console.warn('Warning: public/logo.png not found. Skipping auto-generation of PWA icons.');
    return;
  }

  try {
    console.log('Production Build Setup: Rendering PWA icons...');
    
    // Ensure 192x192 is generated
    await sharp(logoPath)
      .resize(192, 192)
      .png()
      .toFile(size192Path);
    console.log('Successfully generated public/logo-192.png');

    // Ensure 512x512 is generated
    await sharp(logoPath)
      .resize(512, 512)
      .png()
      .toFile(size512Path);
    console.log('Successfully generated public/logo-512.png');

  } catch (err) {
    console.error('Failed to auto-generate PWA icons during build:', err);
  }
}

generate();
