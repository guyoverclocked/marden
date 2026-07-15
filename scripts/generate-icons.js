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
