#!/usr/bin/env node

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { TELETEXT_CONFIG } from "../src/config.mjs";
import { generateTeletext } from "../src/generator.mjs";

const args = process.argv.slice(2);
let outputDir = TELETEXT_CONFIG.outputDir;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--output-dir" && args[i + 1]) {
    outputDir = args[++i];
  }
}

outputDir = resolve(outputDir);

async function main() {
  console.log("Generating teletext pages...");
  console.log(`  M3U:    ${TELETEXT_CONFIG.m3uUrl}`);
  console.log(`  XMLTV:  ${TELETEXT_CONFIG.xmltvUrl}`);
  console.log(`  Output: ${outputDir}`);

  const pages = await generateTeletext(TELETEXT_CONFIG);

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  let count = 0;
  for (const [filename, content] of Object.entries(pages)) {
    const filepath = join(outputDir, filename);
    writeFileSync(filepath, content, "latin1");
    count++;
  }

  console.log(`Generated ${count} teletext page files in ${outputDir}`);
}

main().catch((err) => {
  console.error("Error:", err.stack);
  process.exit(1);
});
