#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";

function parseArgs(argv) {
  const out = {
    mode: "interactions",
    model: "gemini-3-pro-image-preview",
    out: "assets/sprites/generated/test-sprite.png",
    aspect: "1:1",
    imageSize: "1K",
    prompt: "",
    promptFile: ""
  };

  for (const arg of argv) {
    if (arg.startsWith("--mode=")) out.mode = arg.slice("--mode=".length);
    else if (arg.startsWith("--model=")) out.model = arg.slice("--model=".length);
    else if (arg.startsWith("--out=")) out.out = arg.slice("--out=".length);
    else if (arg.startsWith("--aspect=")) out.aspect = arg.slice("--aspect=".length);
    else if (arg.startsWith("--image-size=")) out.imageSize = arg.slice("--image-size=".length);
    else if (arg.startsWith("--prompt=")) out.prompt = arg.slice("--prompt=".length);
    else if (arg.startsWith("--prompt-file=")) out.promptFile = arg.slice("--prompt-file=".length);
    else if (arg === "--help") out.help = true;
  }

  return out;
}

function usage() {
  console.log(`Usage:
  node scripts/generate-gemini-sprite.mjs --mode=interactions --model=gemini-3-pro-image-preview --out=assets/sprites/generated/w1-enemy.png --aspect=1:1 --image-size=1K --prompt="..."

Options:
  --mode=interactions|images
  --model=<model-id>
  --out=<output-png-path>
  --aspect=1:1|2:3|3:2|3:4|4:3|4:5|5:4|9:16|16:9|21:9
  --image-size=1K|2K|4K
  --prompt="<text>"
  --prompt-file=<path-to-txt>
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY.");
  }

  let prompt = args.prompt.trim();
  if (!prompt && args.promptFile) {
    prompt = (await fs.readFile(args.promptFile, "utf8")).trim();
  }
  if (!prompt) {
    throw new Error("Missing prompt. Provide --prompt or --prompt-file.");
  }

  const ai = new GoogleGenAI({ apiKey });
  let imageBytes = "";
  let mimeType = "image/png";

  if (args.mode === "images") {
    const response = await ai.models.generateImages({
      model: args.model,
      prompt,
      config: {
        numberOfImages: 1,
        aspectRatio: args.aspect,
        imageSize: args.imageSize
      }
    });
    imageBytes = response?.generatedImages?.[0]?.image?.imageBytes ?? "";
    mimeType = response?.generatedImages?.[0]?.image?.mimeType ?? "image/png";
  } else {
    const interaction = await ai.interactions.create({
      model: args.model,
      input: prompt,
      response_modalities: ["image"],
      generation_config: {
        image_config: {
          aspect_ratio: args.aspect,
          image_size: args.imageSize
        }
      }
    });

    const output = (interaction.outputs ?? []).find((item) => item.type === "image");
    imageBytes = output?.data ?? "";
    mimeType = output?.mime_type ?? "image/png";
  }

  if (!imageBytes) {
    throw new Error("No image bytes returned from model.");
  }

  const outputPath = path.resolve(args.out);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, Buffer.from(imageBytes, "base64"));
  console.log(`Wrote ${outputPath} (${mimeType})`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
