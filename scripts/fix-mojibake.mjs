// Fix double-encoded UTF-8 (CP1252-decoded then UTF-8-re-encoded).
// PS 5.1's Set-Content -Encoding utf8 mangles non-ASCII chars when paired
// with non-Raw Get-Content. Run AFTER ensuring all needed string-replacements
// were already applied (the import path fix is in the file content already).
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import * as path from 'node:path';

const ROOT = process.argv[2] ?? 'apps/dashboard/src';

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|css|md)$/.test(name)) out.push(p);
  }
  return out;
}

let fixed = 0;
for (const file of walk(ROOT)) {
  let text = readFileSync(file, 'utf8');
  // Strip BOM if present.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  if (!text.includes('â€') && !text.includes('Ã©') && !text.includes('â€™')) continue;
  // Re-encode each codepoint as a single CP1252 byte (where possible),
  // then decode that byte buffer as UTF-8.
  // Map each Unicode codepoint to a single byte using a CP1252-aware table.
  // The mangling happened because Set-Content -Encoding utf8 on PS 5.1
  // re-encodes chars assuming the *file* is utf-16, producing CP1252-style
  // glyphs for the original UTF-8 bytes (0x80-0xFF range).
  const cp1252ToByte = (c) => {
    const map = {
      '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87,
      'ˆ': 0x88, '‰': 0x89, 'Š': 0x8A, '‹': 0x8B, 'Œ': 0x8C, 'Ž': 0x8E,
      '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97,
      '˜': 0x98, '™': 0x99, 'š': 0x9A, '›': 0x9B, 'œ': 0x9C, 'ž': 0x9E, 'Ÿ': 0x9F,
    };
    if (c in map) return map[c];
    const code = c.codePointAt(0);
    return code < 256 ? code : null;
  };
  const buf = [];
  let bad = false;
  for (const ch of text) {
    const b = cp1252ToByte(ch);
    if (b == null) { bad = true; break; }
    buf.push(b);
  }
  if (bad) { console.log(`SKIP (non-byte char): ${file}`); continue; }
  const bytes = Buffer.from(buf);
  let recovered;
  try {
    recovered = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    console.log(`SKIP (not recoverable): ${file}`);
    continue;
  }
  if (recovered === text) continue;
  // Strip any leading BOM that PS may have added.
  if (recovered.charCodeAt(0) === 0xfeff) recovered = recovered.slice(1);
  writeFileSync(file, recovered, 'utf8');
  fixed++;
  console.log(`fixed: ${file}`);
}
console.log(`\n${fixed} files fixed.`);
