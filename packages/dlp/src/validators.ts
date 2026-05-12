/**
 * Cryptographic / mathematical validators that turn a regex match into a
 * high-confidence finding. Each returns true if the candidate passes the
 * formal check (Luhn, Verhoeff, mod-97, etc.) — so a 16-digit number that
 * isn't a real credit card stops generating false positives.
 */

/** Luhn checksum — used by credit card numbers, IMEI, SIN, NPI. */
export function luhnValid(digits: string): boolean {
  const clean = digits.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(clean) || clean.length < 12) return false;
  let sum = 0;
  let alt = false;
  for (let i = clean.length - 1; i >= 0; i--) {
    let n = clean.charCodeAt(i) - 48;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/** Verhoeff checksum — Indian Aadhaar. */
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export function verhoeffValid(digits: string): boolean {
  const clean = digits.replace(/\s/g, '');
  if (!/^\d{12}$/.test(clean)) return false;
  let c = 0;
  const reversed = clean.split('').reverse();
  for (let i = 0; i < reversed.length; i++) {
    const d = Number(reversed[i]);
    c = VERHOEFF_D[c]![VERHOEFF_P[i % 8]![d]!]!;
  }
  return c === 0;
}

/** ABA routing number — 9 digits, weighted checksum. */
export function abaValid(digits: string): boolean {
  const clean = digits.replace(/\D/g, '');
  if (clean.length !== 9) return false;
  const ds = clean.split('').map(Number);
  const sum = 3 * (ds[0]! + ds[3]! + ds[6]!) + 7 * (ds[1]! + ds[4]! + ds[7]!) + (ds[2]! + ds[5]! + ds[8]!);
  return sum % 10 === 0;
}

/** IBAN mod-97 check. */
export function ibanValid(candidate: string): boolean {
  const clean = candidate.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(clean)) return false;
  const rearranged = clean.slice(4) + clean.slice(0, 4);
  const numeric = rearranged
    .split('')
    .map((c) => {
      const code = c.charCodeAt(0);
      return code >= 65 ? String(code - 55) : c;
    })
    .join('');
  // Compute numeric mod 97 in chunks to avoid BigInt overhead.
  let remainder = 0;
  for (const c of numeric) {
    remainder = (remainder * 10 + (c.charCodeAt(0) - 48)) % 97;
  }
  return remainder === 1;
}

/** NHS (UK) — 10-digit with mod 11 checksum. */
export function nhsValid(digits: string): boolean {
  const clean = digits.replace(/\D/g, '');
  if (clean.length !== 10) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(clean[i]) * (10 - i);
  const check = (11 - (sum % 11)) % 11;
  if (check === 10) return false;
  return check === Number(clean[9]);
}

/** PAN (India) format-only — five letters, four digits, one letter. */
export function panValid(s: string): boolean {
  return /^[A-Z]{5}\d{4}[A-Z]$/.test(s);
}

/** SSN sanity — reject all-zero areas, group 00, and known invalid blocks. */
export function ssnValid(s: string): boolean {
  const m = /^(\d{3})[-\s](\d{2})[-\s](\d{4})$/.exec(s);
  if (!m) return false;
  const area = Number(m[1]);
  const group = Number(m[2]);
  const serial = Number(m[3]);
  if (area === 0 || area === 666 || area >= 900) return false;
  if (group === 0 || serial === 0) return false;
  return true;
}

/** CPF (Brazil) — 11 digits with two check digits. */
export function cpfValid(s: string): boolean {
  const clean = s.replace(/\D/g, '');
  if (clean.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(clean)) return false;
  const calc = (slice: string, mod: number): number => {
    let sum = 0;
    for (let i = 0; i < slice.length; i++) sum += Number(slice[i]) * (mod - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(clean.slice(0, 9), 10) === Number(clean[9]) && calc(clean.slice(0, 10), 11) === Number(clean[10]);
}

/** CNPJ (Brazil company tax id) — 14 digits with checksum. */
export function cnpjValid(s: string): boolean {
  const clean = s.replace(/\D/g, '');
  if (clean.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(clean)) return false;
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const check = (digits: string, weights: number[]): number => {
    let sum = 0;
    for (let i = 0; i < digits.length; i++) sum += Number(digits[i]) * weights[i]!;
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return check(clean.slice(0, 12), weights1) === Number(clean[12]) && check(clean.slice(0, 13), weights2) === Number(clean[13]);
}

/** SIN (Canada) — Luhn over 9 digits. */
export function sinValid(s: string): boolean {
  const clean = s.replace(/\D/g, '');
  return clean.length === 9 && luhnValid(clean);
}

/** NRIC (Singapore) — letter prefix + 7 digits + check letter. */
export function nricValid(s: string): boolean {
  const m = /^([STFG])(\d{7})([A-Z])$/i.exec(s.trim());
  if (!m) return false;
  const prefix = m[1]!.toUpperCase();
  const digits = m[2]!;
  const check = m[3]!.toUpperCase();
  const weights = [2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += Number(digits[i]) * weights[i]!;
  if (prefix === 'T' || prefix === 'G') sum += 4;
  const letters =
    prefix === 'S' || prefix === 'T'
      ? ['J', 'Z', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A']
      : ['X', 'W', 'U', 'T', 'R', 'Q', 'P', 'N', 'M', 'L', 'K'];
  return letters[sum % 11] === check;
}

/** Australian TFN — 8 or 9 digits with weighted checksum. */
export function tfnValid(s: string): boolean {
  const clean = s.replace(/\D/g, '');
  if (clean.length !== 8 && clean.length !== 9) return false;
  const weights8 = [10, 7, 8, 4, 6, 3, 5, 1];
  const weights9 = [1, 4, 3, 7, 5, 8, 6, 9, 10];
  const weights = clean.length === 8 ? weights8 : weights9;
  let sum = 0;
  for (let i = 0; i < clean.length; i++) sum += Number(clean[i]) * weights[i]!;
  return sum % 11 === 0;
}

/** US EIN — XX-XXXXXXX with valid area prefix. */
export function einValid(s: string): boolean {
  const m = /^(\d{2})-?(\d{7})$/.exec(s.trim());
  if (!m) return false;
  const validPrefixes = new Set([
    '01','02','03','04','05','06','10','11','12','13','14','15','16','20','21','22','23','24','25','26','27',
    '30','31','32','33','34','35','36','37','38','39','40','41','42','43','44','45','46','47','48',
    '50','51','52','53','54','55','56','57','58','59','60','61','62','63','64','65','66','67','68',
    '71','72','73','74','75','76','77','80','81','82','83','84','85','86','87','88','90','91','92','93','94','95','98','99',
  ]);
  return validPrefixes.has(m[1]!);
}

/** SWIFT/BIC — 8 or 11 alphanumeric. */
export function swiftValid(s: string): boolean {
  return /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(s.trim().toUpperCase());
}

/** Bitcoin legacy / segwit (bech32) address. */
export function bitcoinValid(s: string): boolean {
  if (/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(s)) return true;
  if (/^bc1[a-z0-9]{8,87}$/i.test(s)) return true;
  return false;
}

/** Ethereum address — 0x + 40 hex chars. */
export function ethereumValid(s: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(s);
}

/** IPv6 — loose RFC 4291 coverage. */
export function ipv6Valid(s: string): boolean {
  if (!s.includes(':')) return false;
  const compressed = s.split('::');
  if (compressed.length > 2) return false;
  const left = (compressed[0] ?? '').split(':').filter(Boolean);
  const right = (compressed[1] ?? '').split(':').filter(Boolean);
  const groups = [...left, ...right];
  if (groups.length === 0 || groups.length > 8) return false;
  return groups.every((g) => /^[0-9a-fA-F]{1,4}$/.test(g));
}

/** IMEI — 15 digits with Luhn. */
export function imeiValid(s: string): boolean {
  const clean = s.replace(/\D/g, '');
  return clean.length === 15 && luhnValid(clean);
}

/** MAC address. */
export function macValid(s: string): boolean {
  return /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/.test(s);
}
