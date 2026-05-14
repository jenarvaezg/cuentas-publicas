#!/usr/bin/env node
/**
 * Inspecciona `src/data/meta.json` y reporta:
 *   1. Fuentes que actualmente sirven valores de fallback.
 *   2. Las 5 fuentes con `lastRealDataDate` más antiguo (informativo).
 *
 * Sale con código 1 si hay fuentes en fallback (útil en CI/precommit),
 * 0 en caso contrario.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const META_PATH = resolve(here, "../src/data/meta.json");

const meta = JSON.parse(readFileSync(META_PATH, "utf-8"));
const sources = meta.sources ?? {};
const now = Date.now();
const dayMs = 86_400_000;

const onFallback = [];
const byAge = [];

for (const [name, src] of Object.entries(sources)) {
  if (src.fallbackDetected || src.criticalFallback) {
    onFallback.push({ name, src });
  }
  if (src.lastRealDataDate) {
    const age = Math.round((now - new Date(src.lastRealDataDate).getTime()) / dayMs);
    byAge.push({ name, age, date: src.lastRealDataDate });
  }
}

console.log(`Fallback audit — meta updated ${meta.lastDownload}\n`);

if (onFallback.length === 0) {
  console.log("All sources serving live data (no fallback detected).\n");
} else {
  console.log(`Sources currently on fallback (${onFallback.length}):`);
  for (const { name, src } of onFallback) {
    const tag = src.criticalFallback ? " [CRITICAL]" : "";
    const keys = src.fallbackKeys?.length ? ` keys=${src.fallbackKeys.join(",")}` : "";
    const reason = src.criticalFallbackReason ? ` reason="${src.criticalFallbackReason}"` : "";
    console.log(`  • ${name}${tag}${keys}${reason}`);
  }
  console.log();
}

if (byAge.length > 0) {
  byAge.sort((a, b) => b.age - a.age);
  const top = byAge.slice(0, 5);
  console.log("Oldest lastRealDataDate (top 5):");
  for (const { name, age, date } of top) {
    console.log(`  • ${name.padEnd(24)} ${String(age).padStart(4)}d  (${date})`);
  }
}

process.exit(onFallback.length > 0 ? 1 : 0);
