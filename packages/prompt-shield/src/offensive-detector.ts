export interface OffensiveDetectionResult {
  detected: boolean;
  category: string | null;
  confidence: number;
  patterns: string[];
}

interface OffensivePattern {
  pattern: RegExp;
  category: string;
  description: string;
  weight: number;
}

const OFFENSIVE_PATTERNS: OffensivePattern[] = [
  { pattern: /\b(write|create|generate|produce|build)\s+(?:me\s+)?(?:a\s+)?(?:functional|working)?\s*(malware|virus|worm|trojan|ransomware|keylogger)\b/i, category: 'MALWARE_CREATION', description: 'Malware creation request', weight: 1.0 },
  { pattern: /\bbypass\s+(?:windows|mac|linux|the)?\s*defender\b/i, category: 'EVASION', description: 'AV evasion', weight: 0.9 },
  { pattern: /\bavoid\s+(?:av|antivirus|edr|detection)\b/i, category: 'EVASION', description: 'Detection evasion', weight: 0.9 },
  { pattern: /\b(?:write|build|develop|create)\s+(?:an?\s+)?exploit\s+(?:for|targeting)\b/i, category: 'EXPLOIT_DEVELOPMENT', description: 'Exploit dev request', weight: 1.0 },
  { pattern: /\b(?:steal|harvest|exfiltrate|dump)\s+(?:credentials|passwords|cookies|tokens|sessions)\b/i, category: 'CREDENTIAL_THEFT', description: 'Credential theft', weight: 1.0 },
  { pattern: /\b(?:phish|phishing)\s+(?:email|page|kit|template|landing)\b/i, category: 'PHISHING', description: 'Phishing artifact', weight: 0.95 },
  { pattern: /\b(?:scan|nmap|recon|enumerate)\s+(?:without\s+permission|illegally|unauthorized)\b/i, category: 'UNAUTHORIZED_SCANNING', description: 'Unauthorized scanning', weight: 0.9 },
  { pattern: /\bDDoS\s+(?:attack|tool|script)\b|\bdenial\s+of\s+service\s+attack\b/i, category: 'DDOS', description: 'DoS attack', weight: 1.0 },
  { pattern: /\b(?:reverse\s+)?shell\s+(?:on|to)\s+(?:victim|target|their|the\s+target)\b/i, category: 'REMOTE_ACCESS', description: 'Unauthorized remote access', weight: 0.95 },
  { pattern: /\b(?:write|create|generate)\s+(?:a\s+)?botnet\b/i, category: 'BOTNET', description: 'Botnet creation', weight: 1.0 },
];

const DEFENSIVE_MARKERS = [
  /\b(?:audit|review|harden|defen[sd]e?|protect|secure|patch|mitigate|remediat\w+|incident\s+response|forensic|blue\s+team|defender|soc\b|threat\s+model|pentest|penetration\s+test)/i,
  /\b(?:ctf|capture\s+the\s+flag|hackthebox|tryhackme|lab\s+environment)/i,
  /\bauthorized\b|\bwith\s+permission\b|\bin\s+my\s+lab\b|\bon\s+my\s+own\s+system\b/i,
];

export function detectOffensiveCyberRequest(text: string): OffensiveDetectionResult {
  if (!text) return { detected: false, category: null, confidence: 0, patterns: [] };

  const matched: { category: string; weight: number; description: string }[] = [];

  for (const { pattern, category, description, weight } of OFFENSIVE_PATTERNS) {
    if (pattern.test(text)) {
      matched.push({ category, weight, description });
    }
  }

  if (matched.length === 0) {
    return { detected: false, category: null, confidence: 0, patterns: [] };
  }

  let confidence = Math.min(matched.reduce((sum, m) => sum + m.weight, 0), 1.0);

  // Down-weight if defensive markers present (~ -0.4)
  for (const marker of DEFENSIVE_MARKERS) {
    if (marker.test(text)) {
      confidence = Math.max(0, confidence - 0.4);
      break;
    }
  }

  const topCategory = matched.sort((a, b) => b.weight - a.weight)[0]?.category ?? null;

  return {
    detected: confidence >= 0.5,
    category: topCategory,
    confidence,
    patterns: matched.map((m) => m.description),
  };
}
