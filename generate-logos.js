import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const fallbackSvg = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Soft Dark Charcoal Background -->
  <rect width="512" height="512" rx="128" fill="#0f172a"/>
  
  <!-- Subtle Gradient Accent Glow in Background -->
  <circle cx="256" cy="220" r="160" fill="url(#bg-glow)" opacity="0.4"/>
  
  <!-- Stylized graduation cap & digital hub connectivity lines -->
  <g transform="translate(141, 110)">
    <!-- Cap Diamond / Learning Nodes -->
    <path d="M115 10 L220 60 L115 110 L10 60 Z" fill="url(#mainGrad)" stroke="#2dd4bf" stroke-width="6"/>
    <path d="M115 100 V160 C115 185 15 185 15 160 V105" fill="none" stroke="url(#mainGrad)" stroke-width="12" stroke-linecap="round"/>
    
    <!-- Secondary connection paths -->
    <circle cx="115" cy="10" r="12" fill="#2dd4bf" stroke="#0f172a" stroke-width="4"/>
    <circle cx="220" cy="60" r="12" fill="#3b82f6" stroke="#0f172a" stroke-width="4"/>
    <circle cx="10" cy="60" r="12" fill="#3b82f6" stroke="#0f172a" stroke-width="4"/>
    <circle cx="115" cy="110" r="12" fill="#2dd4bf" stroke="#0f172a" stroke-width="4"/>
    
    <!-- Cap Tassel string to side -->
    <path d="M175 80 C195 90, 205 110, 205 130" stroke="#00a884" stroke-width="6" stroke-linecap="round"/>
    <circle cx="205" cy="130" r="10" fill="#00a884"/>
  </g>

  <!-- Title & Professional Branding -->
  <text x="256" y="380" font-family="'Inter', system-ui, -apple-system, sans-serif" font-weight="800" font-size="44" fill="#ffffff" text-anchor="middle" letter-spacing="-1">TuitionHub</text>
  <text x="256" y="415" font-family="'JetBrains Mono', monospace" font-weight="600" font-size="16" fill="#2dd4bf" text-anchor="middle" letter-spacing="4">LEARNING NETWORK</text>

  <defs>
    <radialGradient id="bg-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#00a884"/>
      <stop offset="100%" stop-color="#0f172a" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="mainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#06b6d4"/> <!-- Cyan -->
      <stop offset="50%" stop-color="#00a884"/> <!-- Emerald-Teal -->
      <stop offset="100%" stop-color="#3b82f6"/> <!-- Blue -->
    </linearGradient>
  </defs>
</svg>
`;

async function generate() {
  const logoPath = path.join(process.cwd(), 'public', 'logo.png');
  const size192Path = path.join(process.cwd(), 'public', 'logo-192.png');
  const size512Path = path.join(process.cwd(), 'public', 'logo-512.png');

  let useFallback = false;

  // Let's verify if the file exists and is a valid image format
  if (!fs.existsSync(logoPath)) {
    console.warn('Warning: public/logo.png does not exist. Using high-fidelity SVG fallback.');
    useFallback = true;
  } else {
    try {
      const stats = fs.statSync(logoPath);
      if (stats.size < 1000) {
        console.warn(`Warning: public/logo.png size is too small (${stats.size} bytes). Likely a Git LFS pointer file. Using SVG fallback.`);
        useFallback = true;
      } else {
        // Try reading/parsing using sharp to ensure it is not corrupt
        await sharp(logoPath).metadata();
        console.log('Confirmed public/logo.png is a valid image format.');
      }
    } catch (e) {
      console.warn('Warning: public/logo.png is not a valid image format. Using SVG fallback. Error:', e.message);
      useFallback = true;
    }
  }

  try {
    const svgBuffer = Buffer.from(fallbackSvg.trim());

    if (useFallback) {
      console.log('Rendering fallback high-fidelity TuitionHub graphics into public/logo.png...');
      await sharp(svgBuffer)
        .png()
        .toFile(logoPath);
    }

    // Now generate 192x192 and 512x512
    const sourceImage = useFallback ? svgBuffer : logoPath;

    console.log('Generating public/logo-192.png...');
    await sharp(sourceImage)
      .resize(192, 192)
      .png()
      .toFile(size192Path);

    console.log('Generating public/logo-512.png...');
    await sharp(sourceImage)
      .resize(512, 512)
      .png()
      .toFile(size512Path);

    console.log('PWA logo generation task completed successfully!');
  } catch (err) {
    console.error('Non-blocking recovery issue during PWA generation:', err.message);
  }
}

generate();
