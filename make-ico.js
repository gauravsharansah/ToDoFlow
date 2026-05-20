/**
 * Creates a proper ICO file from PNG images.
 * ICO format: header + directory entries + image data (as PNG chunks).
 */
const fs = require('fs');
const path = require('path');

async function makePngBuffer(size) {
  const sharp = require('sharp');
  return sharp(path.join(__dirname, 'src', 'icon-256.png'))
    .resize(size, size)
    .png()
    .toBuffer();
}

async function buildIco() {
  const sizes = [16, 32, 48, 64, 128, 256];
  const pngBuffers = await Promise.all(sizes.map(s => makePngBuffer(s)));

  const numImages = sizes.length;
  const headerSize = 6; // ICONDIR
  const dirEntrySize = 16; // ICONDIRENTRY per image
  const dirSize = headerSize + numImages * dirEntrySize;

  // Calculate offsets
  let offset = dirSize;
  const offsets = pngBuffers.map(buf => {
    const o = offset;
    offset += buf.length;
    return o;
  });

  // Build ICONDIR header
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);  // reserved
  header.writeUInt16LE(1, 2);  // type: 1 = ICO
  header.writeUInt16LE(numImages, 4);

  // Build directory entries
  const dirEntries = pngBuffers.map((buf, i) => {
    const entry = Buffer.alloc(16);
    const sz = sizes[i];
    entry.writeUInt8(sz >= 256 ? 0 : sz, 0);  // width (0 = 256)
    entry.writeUInt8(sz >= 256 ? 0 : sz, 1);  // height (0 = 256)
    entry.writeUInt8(0, 2);   // color count
    entry.writeUInt8(0, 3);   // reserved
    entry.writeUInt16LE(1, 4); // planes
    entry.writeUInt16LE(32, 6); // bit count
    entry.writeUInt32LE(buf.length, 8);  // size of image data
    entry.writeUInt32LE(offsets[i], 12); // offset of image data
    return entry;
  });

  const icoBuffer = Buffer.concat([header, ...dirEntries, ...pngBuffers]);
  const outPath = path.join(__dirname, 'src', 'icon.ico');
  fs.writeFileSync(outPath, icoBuffer);
  console.log(`Created ${outPath} (${icoBuffer.length} bytes, ${numImages} sizes: ${sizes.join(', ')})`);
}

buildIco().catch(err => { console.error(err); process.exit(1); });
