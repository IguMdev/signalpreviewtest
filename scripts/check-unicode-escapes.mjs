#!/usr/bin/env node
// Detecta escapes \uXXXX dentro de strings em arquivos src/ que poderiam ser
// caracteres acentuados reais. Usado para evitar regressões de encoding nos
// textos PT-BR (ex.: "n\u00e3o" em vez de "não").
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import { execSync } from "node:child_process";

const files = execSync("git ls-files 'src/**/*.ts' 'src/**/*.tsx'", {
  encoding: "utf8",
}).trim().split("\n").filter(Boolean);

const RE = /\\u00[0-9a-fA-F]{2}/g;
let bad = 0;
for (const f of files) {
  const txt = readFileSync(f, "utf8");
  const lines = txt.split("\n");
  lines.forEach((line, i) => {
    if (RE.test(line)) {
      console.log(`${f}:${i + 1}: ${line.trim()}`);
      bad++;
    }
    RE.lastIndex = 0;
  });
}
if (bad > 0) {
  console.error(`\n✖ ${bad} linha(s) com escapes \\u00xx. Substitua por acentos reais.`);
  process.exit(1);
}
console.log("✓ Sem escapes Unicode quebrados.");