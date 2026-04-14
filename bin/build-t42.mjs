#!/usr/bin/env node
/**
 * Convert generated TTI pages into a .t42 file for TheMarco's browser viewer.
 *
 * Usage:
 *   node bin/build-t42.mjs [--input-dir ./teletext-pages] [--output guide.t42]
 *
 * Requires TheMarco/teletext to be installed at ~/Projects/TheMarco/teletext
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";

const TELETEXT_PROJECT = resolve(process.env.HOME, "Projects/TheMarco/teletext");

const args = process.argv.slice(2);
let inputDir = "./teletext-pages";
let outputFile = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--input-dir" && args[i + 1]) inputDir = args[++i];
  if (args[i] === "--output" && args[i + 1]) outputFile = args[++i];
}

inputDir = resolve(inputDir);
if (!outputFile) outputFile = resolve(inputDir, "guide.t42");
else outputFile = resolve(outputFile);

const files = readdirSync(inputDir)
  .filter((f) => f.endsWith(".tti"))
  .sort();

if (files.length === 0) {
  console.error(`No .tti files found in ${inputDir}`);
  process.exit(1);
}

const combined = files
  .map((f) => readFileSync(join(inputDir, f), "utf-8"))
  .join("\n");

console.log(`Read ${files.length} TTI files from ${inputDir}`);

const tmpFile = join(tmpdir(), "teletext-combined.tti");
writeFileSync(tmpFile, combined, "utf-8");

const script = `
import { readFileSync, writeFileSync } from 'node:fs';
import { importTti } from './src/tti/index.js';
import { exportServiceToT42 } from './src/tti/t42Export.js';

const text = readFileSync(${JSON.stringify(tmpFile)}, 'utf-8');
const service = importTti(text, 'guide', 'TV Guide');
console.log('Parsed ' + service.pages.length + ' pages');
const t42 = exportServiceToT42(service);
writeFileSync(${JSON.stringify(outputFile)}, t42);
console.log('Wrote ' + t42.length + ' bytes (' + Math.floor(t42.length / 42) + ' packets) to ${outputFile}');
`;

const tmpScript = join(TELETEXT_PROJECT, ".build-t42-helper.ts");
writeFileSync(tmpScript, script, "utf-8");

try {
  execSync(`npx tsx ${tmpScript}`, {
    cwd: TELETEXT_PROJECT,
    stdio: "inherit",
  });
} catch (err) {
  console.error("T42 build failed");
  process.exit(1);
}
