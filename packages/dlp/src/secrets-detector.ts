export enum SecretType {
  AWS_ACCESS_KEY = 'AWS_ACCESS_KEY',
  AWS_SECRET_KEY = 'AWS_SECRET_KEY',
  GITHUB_TOKEN = 'GITHUB_TOKEN',
  SLACK_TOKEN = 'SLACK_TOKEN',
  STRIPE_KEY = 'STRIPE_KEY',
  OPENAI_KEY = 'OPENAI_KEY',
  ANTHROPIC_KEY = 'ANTHROPIC_KEY',
  GOOGLE_API_KEY = 'GOOGLE_API_KEY',
  PRIVATE_KEY_PEM = 'PRIVATE_KEY_PEM',
  JWT = 'JWT',
  GENERIC_API_KEY = 'GENERIC_API_KEY',
  PASSWORD_FIELD = 'PASSWORD_FIELD',
}

export interface SecretMatch {
  type: SecretType;
  value: string;
  startIndex: number;
  endIndex: number;
}

export interface SecretDetectionResult {
  found: SecretType[];
  matches: SecretMatch[];
  redacted: string;
  containsSecrets: boolean;
}

interface SecretPattern {
  type: SecretType;
  pattern: RegExp;
  redactedLabel: string;
}

const SECRET_PATTERNS: SecretPattern[] = [
  {
    type: SecretType.AWS_ACCESS_KEY,
    pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
    redactedLabel: '[REDACTED-AWS-KEY]',
  },
  {
    type: SecretType.AWS_SECRET_KEY,
    pattern: /\baws_secret_access_key[\s=:]+[A-Za-z0-9/+=]{40}\b/gi,
    redactedLabel: '[REDACTED-AWS-SECRET]',
  },
  {
    type: SecretType.GITHUB_TOKEN,
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/g,
    redactedLabel: '[REDACTED-GITHUB-TOKEN]',
  },
  {
    type: SecretType.SLACK_TOKEN,
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
    redactedLabel: '[REDACTED-SLACK-TOKEN]',
  },
  {
    type: SecretType.STRIPE_KEY,
    pattern: /\b(?:sk|pk|rk)_(?:test|live)_[A-Za-z0-9]{24,}\b/g,
    redactedLabel: '[REDACTED-STRIPE-KEY]',
  },
  {
    type: SecretType.OPENAI_KEY,
    pattern: /\bsk-[A-Za-z0-9]{32,}\b/g,
    redactedLabel: '[REDACTED-OPENAI-KEY]',
  },
  {
    type: SecretType.ANTHROPIC_KEY,
    pattern: /\bsk-ant-[A-Za-z0-9\-_]{20,}\b/g,
    redactedLabel: '[REDACTED-ANTHROPIC-KEY]',
  },
  {
    type: SecretType.GOOGLE_API_KEY,
    pattern: /\bAIza[0-9A-Za-z\-_]{35}\b/g,
    redactedLabel: '[REDACTED-GOOGLE-KEY]',
  },
  {
    type: SecretType.PRIVATE_KEY_PEM,
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----[\s\S]+?-----END [^-]+-----/g,
    redactedLabel: '[REDACTED-PRIVATE-KEY]',
  },
  {
    type: SecretType.JWT,
    pattern: /\beyJ[A-Za-z0-9_\-]+\.eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\b/g,
    redactedLabel: '[REDACTED-JWT]',
  },
  {
    type: SecretType.PASSWORD_FIELD,
    pattern: /\b(?:password|passwd|pwd)[\s=:"']+[^\s"',\}]{6,}/gi,
    redactedLabel: '[REDACTED-PASSWORD]',
  },
  {
    type: SecretType.GENERIC_API_KEY,
    pattern: /\b(?:api[_\-]?key|apikey|secret|token)[\s=:"']+[A-Za-z0-9_\-]{20,}/gi,
    redactedLabel: '[REDACTED-API-KEY]',
  },
];

export function detectSecrets(text: string): SecretDetectionResult {
  if (!text) return { found: [], matches: [], redacted: text ?? '', containsSecrets: false };
  const matches: SecretMatch[] = [];
  const foundTypes = new Set<SecretType>();
  let redacted = text;

  for (const { type, pattern, redactedLabel } of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      matches.push({
        type,
        value: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
      foundTypes.add(type);
    }
    pattern.lastIndex = 0;
    redacted = redacted.replace(pattern, redactedLabel);
  }

  return {
    found: [...foundTypes],
    matches,
    redacted,
    containsSecrets: foundTypes.size > 0,
  };
}

export function containsSecrets(text: string): boolean {
  return detectSecrets(text).containsSecrets;
}

export function redactSecrets(text: string): string {
  return detectSecrets(text).redacted;
}
