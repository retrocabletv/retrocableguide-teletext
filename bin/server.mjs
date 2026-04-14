#!/usr/bin/env node

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { TELETEXT_CONFIG } from "../src/config.mjs";
import { generateTeletext } from "../src/generator.mjs";

const args = process.argv.slice(2);
let outputDir = TELETEXT_CONFIG.outputDir;
let intervalMinutes = 15;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--output-dir" && args[i + 1]) {
    outputDir = args[++i];
  } else if (args[i] === "--interval" && args[i + 1]) {
    intervalMinutes = Number(args[++i]);
  }
}

outputDir = resolve(outputDir);

function timestamp() {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

async function generate() {
  const start = Date.now();
  const pages = await generateTeletext(TELETEXT_CONFIG);

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  let count = 0;
  for (const [filename, content] of Object.entries(pages)) {
    writeFileSync(join(outputDir, filename), content, "latin1");
    count++;
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[${timestamp()}] Generated ${count} pages in ${elapsed}s`);
}

console.log(`Teletext server starting`);
console.log(`  M3U:      ${TELETEXT_CONFIG.m3uUrl}`);
console.log(`  XMLTV:    ${TELETEXT_CONFIG.xmltvUrl}`);
console.log(`  Output:   ${outputDir}`);
console.log(`  Interval: ${intervalMinutes}m`);
console.log();

try {
  await generate();
} catch (err) {
  console.error(`[${timestamp()}] Error:`, err.message);
}

setInterval(async () => {
  try {
    await generate();
  } catch (err) {
    console.error(`[${timestamp()}] Error:`, err.message);
  }
}, intervalMinutes * 60 * 1000);
