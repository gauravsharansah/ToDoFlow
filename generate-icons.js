const fs = require('fs');
const path = require('path');

// SVG source — a clean 1024×1024 TodoFlow icon.
// Replace SVG_ICON with your own design, or point sharp() at a high-res PNG:
//   e.g.  sharp('/path/to/your-logo-1024.png').resize(s, s)...
const SVG_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" rx="200" fill="#1a1a2e"/>
  <rect x="140" y="140" width="744" height="744" rx="160" fill="#5b4fff" opacity="0.15"/>
  <!-- Checkmark -->
  <path d="M320 512 L450 640 L704 384"
        stroke="#5b4fff" stroke-width="80"
        stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <!-- Decorative task lines -->
  <rect x="260" y="680" width="240" height="24" rx="12" fill="rgba(255,255,255,0.15)"/>
  <rect x="260" y="720" width="180" height="24" rx="12" fill="rgba(255,255,255,0.10)"/>
</svg>`;

// All sizes that will be written to src/icon-{size}.png
// 256 is included here — make-ico.js depends on src/icon-256.png
const SIZES = [16, 32, 48, 64, 128, 192, 256, 512, 1024];

async function run() {
  // Auto-install sharp if not present
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.log('sharp not found — installing...');
    require('child_process').execSync('npm install sharp --save-dev', { stdio: 'inherit' });
    sharp = require('sharp');
  }

  const srcDir = path.join(__dirname, 'src');

  // Make sure the output directory exists
  if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir, { recursive: true });
    console.log(`Created directory: src/`);
  }

  const svgBuf = Buffer.from(SVG_ICON);

  console.log(`\nGenerating ${SIZES.length} icon sizes into src/...\n`);

  // Single loop — covers every required size including 192, 256, and 512.
  for (const size of SIZES) {
    const outPath = path.join(srcDir, `icon-${size}.png`);
    await sharp(svgBuf).resize(size, size).png().toFile(outPath);
    console.log(`  ✓ icon-${size}.png`);
  }

  console.log(`
✅ All icons generated in src/

Next steps:
  • Windows .ico  → run:  node make-ico.js          (reads src/icon-256.png)
  • Mac    .icns  → run:  iconutil -c icns <iconset> (manual step)
  • PWA / Android → src/icon-192.png and src/icon-512.png are ready
  `);
}

run().catch(err => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
