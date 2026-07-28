import fs from "node:fs";
import { PNG } from "pngjs";

const size = 1024;
const background = [247, 244, 238, 255];
const png = new PNG({ width: size, height: size });
for (let y = 0; y < size; y += 1) {
  for (let x = 0; x < size; x += 1) setPixel(x, y, background);
}

const yellow = [229, 184, 75, 255];
const ink = [23, 32, 28, 255];
const paper = [247, 244, 238, 255];

line(680, 72, 680, 130, 28, yellow);
line(470, 150, 510, 190, 28, yellow);
line(890, 150, 850, 190, 28, yellow);
line(960, 300, 902, 300, 28, yellow);
circle(680, 300, 174, yellow);
ellipse(512, 730, 405, 235, [31, 122, 90, 255]);

polyline([
  [150, 786],
  [250, 700],
  [365, 640],
  [473, 628],
  [570, 570],
  [660, 505],
  [750, 485],
  [850, 465]
], 38, ink);
waypoint(150, 786);
waypoint(473, 628);
waypoint(750, 485);

fs.writeFileSync(new URL("./icon.png", import.meta.url), PNG.sync.write(png));
fs.writeFileSync(new URL("./splash.png", import.meta.url), PNG.sync.write(png));
const foreground = PNG.sync.read(PNG.sync.write(png));
for (let index = 0; index < foreground.data.length; index += 4) {
  if (foreground.data[index] === background[0] && foreground.data[index + 1] === background[1] && foreground.data[index + 2] === background[2]) foreground.data[index + 3] = 0;
}
fs.writeFileSync(new URL("./icon-foreground.png", import.meta.url), PNG.sync.write(foreground));

function setPixel(x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const index = (size * y + x) << 2;
  png.data[index] = color[0];
  png.data[index + 1] = color[1];
  png.data[index + 2] = color[2];
  png.data[index + 3] = color[3];
}

function circle(cx, cy, radius, color) {
  for (let y = cy - radius; y <= cy + radius; y += 1) for (let x = cx - radius; x <= cx + radius; x += 1) if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) setPixel(x, y, color);
}

function ellipse(cx, cy, radiusX, radiusY, color) {
  for (let y = cy - radiusY; y <= cy + radiusY; y += 1) for (let x = cx - radiusX; x <= cx + radiusX; x += 1) if (((x - cx) / radiusX) ** 2 + ((y - cy) / radiusY) ** 2 <= 1) setPixel(x, y, color);
}

function line(x1, y1, x2, y2, width, color) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  for (let step = 0; step <= steps; step += 1) {
    const x = x1 + (x2 - x1) * step / steps;
    const y = y1 + (y2 - y1) * step / steps;
    circle(Math.round(x), Math.round(y), width / 2, color);
  }
}

function polyline(points, width, color) {
  for (let index = 1; index < points.length; index += 1) {
    const [x1, y1] = points[index - 1];
    const [x2, y2] = points[index];
    line(x1, y1, x2, y2, width, color);
  }
}

function waypoint(x, y) {
  circle(x, y, 36, paper);
  circle(x, y, 21, [50, 107, 143, 255]);
}
