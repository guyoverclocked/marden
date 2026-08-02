const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const root = path.resolve(__dirname, '..');

const hex = (value, alpha = 255) => {
  const color = value.replace('#', '');
  return [
    parseInt(color.slice(0, 2), 16),
    parseInt(color.slice(2, 4), 16),
    parseInt(color.slice(4, 6), 16),
    alpha,
  ];
};

const put = (png, x, y, color) => {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const index = (Math.floor(y) * png.width + Math.floor(x)) * 4;
  const alpha = color[3] / 255;
  const inverse = 1 - alpha;
  png.data[index] = Math.round(color[0] * alpha + png.data[index] * inverse);
  png.data[index + 1] = Math.round(color[1] * alpha + png.data[index + 1] * inverse);
  png.data[index + 2] = Math.round(color[2] * alpha + png.data[index + 2] * inverse);
  png.data[index + 3] = Math.round((alpha + (png.data[index + 3] / 255) * inverse) * 255);
};

const fill = (png, color) => {
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) put(png, x, y, color);
  }
};

const polygon = (png, points, color) => {
  const minX = Math.max(0, Math.floor(Math.min(...points.map(([x]) => x))));
  const maxX = Math.min(png.width - 1, Math.ceil(Math.max(...points.map(([x]) => x))));
  const minY = Math.max(0, Math.floor(Math.min(...points.map(([, y]) => y))));
  const maxY = Math.min(png.height - 1, Math.ceil(Math.max(...points.map(([, y]) => y))));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
        const [xi, yi] = points[i];
        const [xj, yj] = points[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) put(png, x, y, color);
    }
  }
};

const roundedRect = (png, x, y, width, height, radius, color) => {
  for (let py = Math.floor(y); py < Math.ceil(y + height); py += 1) {
    for (let px = Math.floor(x); px < Math.ceil(x + width); px += 1) {
      const cx = Math.max(x + radius, Math.min(px, x + width - radius));
      const cy = Math.max(y + radius, Math.min(py, y + height - radius));
      if ((px - cx) ** 2 + (py - cy) ** 2 <= radius ** 2) put(png, px, py, color);
    }
  }
};

const drawMark = (png, x, y, size, markColor, seamColor) => {
  const p = (value) => value * size;
  polygon(
    png,
    [
      [x + p(0.08), y + p(0.12)],
      [x + p(0.47), y + p(0.2)],
      [x + p(0.49), y + p(0.87)],
      [x + p(0.16), y + p(0.76)],
    ],
    markColor,
  );
  polygon(
    png,
    [
      [x + p(0.53), y + p(0.2)],
      [x + p(0.93), y + p(0.1)],
      [x + p(0.84), y + p(0.76)],
      [x + p(0.51), y + p(0.87)],
    ],
    markColor,
  );
  polygon(
    png,
    [
      [x + p(0.485), y + p(0.2)],
      [x + p(0.525), y + p(0.2)],
      [x + p(0.525), y + p(0.86)],
      [x + p(0.49), y + p(0.87)],
    ],
    seamColor,
  );
  polygon(
    png,
    [
      [x + p(0.62), y + p(0.38)],
      [x + p(0.83), y + p(0.33)],
      [x + p(0.82), y + p(0.365)],
      [x + p(0.615), y + p(0.415)],
    ],
    seamColor,
  );
  polygon(
    png,
    [
      [x + p(0.61), y + p(0.5)],
      [x + p(0.79), y + p(0.46)],
      [x + p(0.785), y + p(0.495)],
      [x + p(0.605), y + p(0.535)],
    ],
    seamColor,
  );
};

const downsample = (large, width, height) => {
  const target = new PNG({ width, height });
  const scaleX = large.width / width;
  const scaleY = large.height / height;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const samples = [];
      for (let sy = 0; sy < scaleY; sy += 1) {
        for (let sx = 0; sx < scaleX; sx += 1) {
          const index = ((Math.floor(y * scaleY + sy) * large.width) + Math.floor(x * scaleX + sx)) * 4;
          samples.push([large.data[index], large.data[index + 1], large.data[index + 2], large.data[index + 3]]);
        }
      }
      const output = (y * width + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        target.data[output + channel] = Math.round(samples.reduce((sum, sample) => sum + sample[channel], 0) / samples.length);
      }
    }
  }
  return target;
};

const write = (fileName, png) => {
  fs.writeFileSync(path.join(root, fileName), PNG.sync.write(png));
};

const renderIcon = (size, transparent = false, monochrome = false) => {
  const scale = 2;
  const png = new PNG({ width: size * scale, height: size * scale });
  if (!transparent) fill(png, hex('#315C4A'));
  const inset = transparent ? size * 0.16 * scale : size * 0.2 * scale;
  drawMark(
    png,
    inset,
    inset,
    size * scale - inset * 2,
    monochrome ? hex('#FFFFFF') : hex('#D7E9A2'),
    transparent && monochrome ? hex('#000000', 55) : hex('#315C4A', 120),
  );
  return downsample(png, size, size);
};

write('assets/icon.png', renderIcon(1024));
write('assets/android-icon-foreground.png', renderIcon(512, true));
write('assets/android-icon-monochrome.png', renderIcon(432, true, true));

const background = new PNG({ width: 432, height: 432 });
fill(background, hex('#315C4A'));
write('assets/android-icon-background.png', background);

const splashLarge = new PNG({ width: 2048, height: 2048 });
roundedRect(splashLarge, 624, 624, 800, 800, 230, hex('#315C4A'));
drawMark(splashLarge, 790, 790, 468, hex('#D7E9A2'), hex('#315C4A', 120));
write('assets/splash-icon.png', downsample(splashLarge, 1024, 1024));
write('assets/favicon.png', renderIcon(48));

console.log('Generated Marden app icons and splash assets.');

// ── Windows .ico generation ───────────────────────────
// electron-builder needs a .ico for Windows builds.
// We produce a multi‑resolution .ico from assets/icon.png using pngjs
// (already installed) by packing BMP frames into an ICO container.

try {
  const source = PNG.sync.read(fs.readFileSync(path.join(root, 'assets', 'icon.png')));
  const sizes = [16, 32, 48, 64, 128, 256];

  // ICO header: reserved(2) + imageType(2) + imageCount(2) = 6 bytes
  const imageCount = sizes.length;
  // directory entry: w(1) + h(1) + palette(1) + reserved(1) + planes(2) + bpp(2) + size(4) + offset(4) = 16 bytes
  const directorySize = 6 + 16 * imageCount;

  const frames = [];
  let dataOffset = directorySize;

  for (const size of sizes) {
    const down = downsample(source, size, size);
    // BMP data: we write BGRA rows bottom → top (BMP row order)
    const rowSize = ((size * 32 + 31) / 32 | 0) * 4;
    const bmpDataSize = rowSize * size;
    const bmpHeaderSize = 40; // BITMAPINFOHEADER
    let bmpData = Buffer.alloc(bmpHeaderSize + bmpDataSize);
    let offset = 0;

    // BITMAPINFOHEADER
    bmpData.writeUInt32LE(40, offset); offset += 4; // biSize
    bmpData.writeInt32LE(size, offset); offset += 4; // biWidth
    bmpData.writeInt32LE(size * 2, offset); offset += 4; // biHeight (double for top‑down + AND mask)
    bmpData.writeUInt16LE(1, offset); offset += 2; // biPlanes
    bmpData.writeUInt16LE(32, offset); offset += 2; // biBitCount
    bmpData.writeUInt32LE(0, offset); offset += 4; // biCompression (BI_RGB)
    bmpData.writeUInt32LE(bmpDataSize, offset); offset += 4; // biSizeImage
    // rest of header is zeroes

    // Pixel rows (bottom → top for BMP)
    offset = bmpHeaderSize;
    for (let y = size - 1; y >= 0; y -= 1) {
      const rowStart = offset;
      for (let x = 0; x < size; x += 1) {
        const srcIdx = (y * size + x) * 4;
        bmpData.writeUInt8(down.data[srcIdx + 2], offset);     // B
        bmpData.writeUInt8(down.data[srcIdx + 1], offset + 1); // G
        bmpData.writeUInt8(down.data[srcIdx], offset + 2);     // R
        bmpData.writeUInt8(down.data[srcIdx + 3], offset + 3); // A
        offset += 4;
      }
      // pad row to 4‑byte boundary
      while ((offset - rowStart) % 4 !== 0) {
        bmpData.writeUInt8(0, offset);
        offset += 1;
      }
    }

    // AND mask: 1 bit per pixel, 0 = opaque (BGRA alpha handles transparency)
    const andMaskRowSize = ((size + 31) / 32 | 0) * 4;
    const andMask = Buffer.alloc(andMaskRowSize * size);
    bmpData = Buffer.concat([bmpData, andMask]);

    frames.push({ size, data: bmpData });
    dataOffset += bmpData.length;
  }

  // Build ICO container
  const icoBuffer = Buffer.alloc(dataOffset);
  let pos = 0;
  icoBuffer.writeUInt16LE(0, pos); pos += 2;          // reserved
  icoBuffer.writeUInt16LE(1, pos); pos += 2;          // type: ICO
  icoBuffer.writeUInt16LE(imageCount, pos); pos += 2;  // image count

  let entryOffset = directorySize;
  for (const frame of frames) {
    icoBuffer.writeUInt8(frame.size === 256 ? 0 : frame.size, pos); pos += 1; // width (0 means 256)
    icoBuffer.writeUInt8(frame.size === 256 ? 0 : frame.size, pos); pos += 1; // height (0 means 256)
    icoBuffer.writeUInt8(0, pos); pos += 1; // palette
    icoBuffer.writeUInt8(0, pos); pos += 1; // reserved
    icoBuffer.writeUInt16LE(1, pos); pos += 2; // planes
    icoBuffer.writeUInt16LE(32, pos); pos += 2; // bpp
    icoBuffer.writeUInt32LE(frame.data.length, pos); pos += 4; // size
    icoBuffer.writeUInt32LE(entryOffset, pos); pos += 4; // offset
    frame.data.copy(icoBuffer, entryOffset);
    entryOffset += frame.data.length;
  }

  fs.writeFileSync(path.join(root, 'assets', 'icon.ico'), icoBuffer);
  console.log('Generated assets/icon.ico (Windows)');
} catch (err) {
  console.warn('Could not generate Windows .ico: ' + err.message);
  console.warn('electron-builder can auto‑convert from icon.png if needed.');
}
