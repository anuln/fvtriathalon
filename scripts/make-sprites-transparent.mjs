#!/usr/bin/env node

import path from "node:path";
import sharp from "sharp";

const DEFAULT_FILES = [
  "assets/sprites/generated/wave1_enemy_test.png",
  "assets/sprites/generated/wave1_enemy_variant2_test.png",
  "assets/sprites/generated/wave1_enemy_variant3_test.png",
  "assets/sprites/generated/wave1_enemy_variant4_test.png",
  "assets/sprites/generated/wave1_bullet_test.png"
];

function parseArgs(argv) {
  const files = [];
  let suffix = "-transparent";
  for (const arg of argv) {
    if (arg.startsWith("--suffix=")) {
      suffix = arg.slice("--suffix=".length) || "-transparent";
      continue;
    }
    if (arg === "--help") {
      return { help: true, files: [], suffix };
    }
    files.push(arg);
  }
  return { help: false, files: files.length > 0 ? files : DEFAULT_FILES, suffix };
}

function usage() {
  console.log(`Usage:\n  node scripts/make-sprites-transparent.mjs [--suffix=-transparent] [file1 file2 ...]\n\nIf no files are provided, Wave 1 generated enemy/bullet sprites are processed.`);
}

function index(x, y, width) {
  return (y * width + x) * 4;
}

function colorDistance(r, g, b, mean) {
  const dr = r - mean.r;
  const dg = g - mean.g;
  const db = b - mean.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function saturation(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min;
}

function computeBorderMean(data, width, height) {
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;

  for (let x = 0; x < width; x += 1) {
    const top = index(x, 0, width);
    const bottom = index(x, height - 1, width);
    sumR += data[top];
    sumG += data[top + 1];
    sumB += data[top + 2];
    sumR += data[bottom];
    sumG += data[bottom + 1];
    sumB += data[bottom + 2];
    count += 2;
  }

  for (let y = 1; y < height - 1; y += 1) {
    const left = index(0, y, width);
    const right = index(width - 1, y, width);
    sumR += data[left];
    sumG += data[left + 1];
    sumB += data[left + 2];
    sumR += data[right];
    sumG += data[right + 1];
    sumB += data[right + 2];
    count += 2;
  }

  return {
    r: sumR / Math.max(1, count),
    g: sumG / Math.max(1, count),
    b: sumB / Math.max(1, count)
  };
}

function pushIfValid(queue, width, height, x, y) {
  if (x < 0 || y < 0 || x >= width || y >= height) {
    return;
  }
  queue.push(y * width + x);
}

function removeBackground(data, width, height) {
  const pixels = width * height;
  const visited = new Uint8Array(pixels);
  const bgMask = new Uint8Array(pixels);
  const queue = [];

  const mean = computeBorderMean(data, width, height);
  const satThreshold = 34;
  const distThreshold = 92;
  const hardThreshold = 60;

  for (let x = 0; x < width; x += 1) {
    queue.push(x);
    queue.push((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    queue.push(y * width);
    queue.push(y * width + (width - 1));
  }

  while (queue.length > 0) {
    const p = queue.pop();
    if (p === undefined || visited[p]) {
      continue;
    }
    visited[p] = 1;

    const x = p % width;
    const y = Math.floor(p / width);
    const i = p * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const sat = saturation(r, g, b);
    const dist = colorDistance(r, g, b, mean);
    const isBackground = (sat <= satThreshold && dist <= distThreshold) || dist <= hardThreshold;

    if (!isBackground) {
      continue;
    }

    bgMask[p] = 1;
    pushIfValid(queue, width, height, x + 1, y);
    pushIfValid(queue, width, height, x - 1, y);
    pushIfValid(queue, width, height, x, y + 1);
    pushIfValid(queue, width, height, x, y - 1);
  }

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let p = 0; p < pixels; p += 1) {
    const i = p * 4;
    if (bgMask[p]) {
      data[i + 3] = 0;
      continue;
    }

    data[i + 3] = 255;
    const x = p % width;
    const y = Math.floor(p / width);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  if (maxX < minX || maxY < minY) {
    return {
      buffer: data,
      width,
      height,
      crop: { left: 0, top: 0, width, height }
    };
  }

  const padX = Math.max(4, Math.round((maxX - minX + 1) * 0.08));
  const padY = Math.max(4, Math.round((maxY - minY + 1) * 0.08));

  const left = Math.max(0, minX - padX);
  const top = Math.max(0, minY - padY);
  const right = Math.min(width - 1, maxX + padX);
  const bottom = Math.min(height - 1, maxY + padY);

  return {
    buffer: data,
    width,
    height,
    crop: {
      left,
      top,
      width: right - left + 1,
      height: bottom - top + 1
    }
  };
}

async function processFile(inputPath, suffix) {
  const source = sharp(inputPath).ensureAlpha();
  const { data, info } = await source.raw().toBuffer({ resolveWithObject: true });
  const processed = removeBackground(data, info.width, info.height);

  const filePath = path.parse(inputPath);
  const outputPath = path.join(filePath.dir, `${filePath.name}${suffix}.png`);

  await sharp(processed.buffer, {
    raw: {
      width: processed.width,
      height: processed.height,
      channels: 4
    }
  })
    .extract(processed.crop)
    .png()
    .toFile(outputPath);

  return outputPath;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  for (const file of args.files) {
    const output = await processFile(file, args.suffix);
    console.log(`Wrote ${output}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
