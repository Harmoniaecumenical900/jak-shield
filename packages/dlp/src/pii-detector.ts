export enum PIIType {
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  SSN = 'SSN',
  CREDIT_CARD = 'CREDIT_CARD',
  DATE_OF_BIRTH = 'DATE_OF_BIRTH',
  MEDICAL_RECORD_NUMBER = 'MEDICAL_RECORD_NUMBER',
  PASSPORT = 'PASSPORT',
  IP_ADDRESS = 'IP_ADDRESS',
  BANK_ACCOUNT = 'BANK_ACCOUNT',
  DRIVER_LICENSE = 'DRIVER_LICENSE',
  AADHAAR = 'AADHAAR',
  PAN = 'PAN',
  STUDENT_RECORD = 'STUDENT_RECORD',
}

export interface PIIMatch {
  type: PIIType;
  value: string;
  startIndex: number;
  endIndex: number;
}

export interface PIIDetectionResult {
  found: PIIType[];
  matches: PIIMatch[];
  redacted: string;
  containsPII: boolean;
}

interface PIIPattern {
  type: PIIType;
  pattern: RegExp;
  redactedLabel: string;
}

const PII_PATTERNS: PIIPattern[] = [
  {
    type: PIIType.EMAIL,
    pattern: /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g,
    redactedLabel: '[REDACTED-EMAIL]',
  },
  {
    type: PIIType.SSN,
    pattern: /\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/g,
    redactedLabel: '[REDACTED-SSN]',
  },
  {
    type: PIIType.AADHAAR,
    // Indian Aadhaar: 12 digits, often grouped 4-4-4
    pattern: /\b\d{4}\s?\d{4}\s?\d{4}\b/g,
    redactedLabel: '[REDACTED-AADHAAR]',
  },
  {
    type: PIIType.PAN,
    // Indian PAN: 5 letters, 4 digits, 1 letter
    pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/g,
    redactedLabel: '[REDACTED-PAN]',
  },
  {
    type: PIIType.CREDIT_CARD,
    pattern:
      /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:\d{4}[-\s]?){3}\d{4})\b/g,
    redactedLabel: '[REDACTED-CC]',
  },
  {
    type: PIIType.PHONE,
    pattern:
      /(\+?1[\s\-.]?)?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}\b|\+\d{1,3}[\s\-.]?\d{2,4}[\s\-.]?\d{4,}/g,
    redactedLabel: '[REDACTED-PHONE]',
  },
  {
    type: PIIType.DATE_OF_BIRTH,
    pattern:
      /\b(?:DOB|Date of Birth|Birth Date|Born)[:\s]+(?:\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})\b/gi,
    redactedLabel: '[REDACTED-DOB]',
  },
  {
    type: PIIType.MEDICAL_RECORD_NUMBER,
    pattern: /\b(?:MRN|Medical Record)[#:\s]+\s*\d{6,10}\b/gi,
    redactedLabel: '[REDACTED-MRN]',
  },
  {
    type: PIIType.PASSPORT,
    pattern: /\b(?:Passport)[#:\s]+[A-Z]{1,2}\d{6,9}\b/g,
    redactedLabel: '[REDACTED-PASSPORT]',
  },
  {
    type: PIIType.IP_ADDRESS,
    pattern:
      /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    redactedLabel: '[REDACTED-IP]',
  },
  {
    type: PIIType.BANK_ACCOUNT,
    pattern: /\b(?:Account|Acct|Routing)[\s#:]+\d{7,17}\b/gi,
    redactedLabel: '[REDACTED-BANK-ACCT]',
  },
  {
    type: PIIType.DRIVER_LICENSE,
    pattern: /\b(?:DL|Driver['\s]?s?\s+License)[#:\s]+[A-Z0-9]{5,15}\b/gi,
    redactedLabel: '[REDACTED-DL]',
  },
  {
    type: PIIType.STUDENT_RECORD,
    // Student ID-like patterns when keyword present
    pattern: /\b(?:Student\s*ID|StudentID|Roll\s*No|Roll\s*Number|Student\s*Record)[#:\s]+[A-Z0-9\-]{3,20}\b/gi,
    redactedLabel: '[REDACTED-STUDENT]',
  },
];

export function detectPII(text: string): PIIDetectionResult {
  if (!text) return { found: [], matches: [], redacted: text ?? '', containsPII: false };
  const matches: PIIMatch[] = [];
  const foundTypes = new Set<PIIType>();
  let redacted = text;

  for (const { type, pattern, redactedLabel } of PII_PATTERNS) {
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
    containsPII: foundTypes.size > 0,
  };
}

export function containsPII(text: string): boolean {
  return detectPII(text).containsPII;
}

export function redactPII(text: string): string {
  return detectPII(text).redacted;
}

export function containsPHI(text: string): boolean {
  const result = detectPII(text);
  const phiTypes: PIIType[] = [
    PIIType.SSN,
    PIIType.MEDICAL_RECORD_NUMBER,
    PIIType.PHONE,
    PIIType.EMAIL,
    PIIType.DATE_OF_BIRTH,
    PIIType.IP_ADDRESS,
    PIIType.AADHAAR,
  ];
  return result.found.some((t) => phiTypes.includes(t));
}
