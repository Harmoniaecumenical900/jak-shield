/**
 * Regulatory Signal Detector — HONESTY NOTE.
 *
 * This module emits **hints**, not legal determinations. We pattern-match for
 * indicators that a tool call likely involves data covered by a regulatory
 * framework. We do NOT:
 *   - assert covered-entity status (HIPAA),
 *   - establish lawful basis (GDPR),
 *   - certify cardholder-data-environment scope (PCI DSS),
 *   - replace a privacy officer's judgment.
 *
 * Use these tags as triage signals, not authoritative classifications.
 * Every result includes confidence, citation, and a required disclaimer.
 */

import { ComplianceTag } from '@jak-shield/shared';
import type { PIIFindingV2, PIITypeV2 } from '@jak-shield/dlp';

export interface ComplianceInput {
  toolName: string;
  args: Record<string, unknown>;
  piiFindings?: PIIFindingV2[];
}

export interface ComplianceHint {
  framework: ComplianceTag;
  confidence: number;
  reason: string;
  citation: string;
  evidence: string[];
}

const PCI_PII: PIITypeV2[] = ['CREDIT_CARD'];
const HIPAA_PII: PIITypeV2[] = [
  'SSN', 'MEDICAL_RECORD_NUMBER', 'DATE_OF_BIRTH', 'NHS', 'IP_ADDRESS', 'EMAIL', 'PHONE',
];
const GDPR_PII: PIITypeV2[] = [
  'EMAIL', 'PHONE', 'IP_ADDRESS', 'IPV6', 'PASSPORT', 'IBAN', 'BITCOIN_ADDR', 'ETHEREUM_ADDR', 'MAC_ADDR',
];
const FERPA_PII: PIITypeV2[] = ['STUDENT_RECORD', 'DATE_OF_BIRTH', 'SSN'];
const DPDP_PII: PIITypeV2[] = ['AADHAAR', 'PAN', 'PHONE', 'EMAIL'];

const SOX_TOOL_HINTS = [/payment/i, /payout/i, /invoice/i, /ledger/i, /financial_(report|disclosure)/i, /\bgaap\b/i];

const GDPR_DOMAINS = [
  '.eu', '.uk', '.de', '.fr', '.it', '.es', '.nl', '.be', '.se', '.no', '.fi', '.dk',
  '.pl', '.cz', '.at', '.ie', '.pt', '.gr',
];

const CITATIONS: Record<ComplianceTag, string> = {
  [ComplianceTag.PCI_DSS]: 'PCI DSS v4.0 Req 3 — Protect stored cardholder data',
  [ComplianceTag.HIPAA]: '45 CFR §164.514(b)(2) — De-identification (18 safe-harbor identifiers)',
  [ComplianceTag.GDPR]: 'GDPR Art. 4(1) — personal data; Art. 6 — lawfulness; Art. 32 — security',
  [ComplianceTag.CCPA]: 'CCPA §1798.140(o) — definition of personal information',
  [ComplianceTag.SOX]: 'SOX §404 — internal control over financial reporting',
  [ComplianceTag.FERPA]: '20 USC §1232g; 34 CFR Part 99 — protection of student records',
  [ComplianceTag.DPDP]: "India Digital Personal Data Protection Act, 2023 — §3, §8",
};

export interface RegulatoryHintsResult {
  tags: ComplianceTag[];
  hints: ComplianceHint[];
  disclaimer: string;
}

const DISCLAIMER =
  'JAK Shield emits regulatory hints based on pattern matching. These are ' +
  'triage signals only and DO NOT constitute legal compliance determinations. ' +
  'A qualified compliance officer must confirm scope, covered-entity status, ' +
  'lawful basis, and applicable controls.';

export function evaluateRegulatoryHints(input: ComplianceInput): RegulatoryHintsResult {
  const hints: ComplianceHint[] = [];
  const piiTypes = new Map<PIITypeV2, PIIFindingV2>();
  for (const f of input.piiFindings ?? []) {
    const existing = piiTypes.get(f.type);
    if (!existing || existing.confidence < f.confidence) piiTypes.set(f.type, f);
  }
  const piiOf = (kinds: PIITypeV2[]): PIIFindingV2[] =>
    kinds.flatMap((k) => (piiTypes.has(k) ? [piiTypes.get(k)!] : []));

  const pci = piiOf(PCI_PII);
  if (pci.length > 0) {
    hints.push({
      framework: ComplianceTag.PCI_DSS,
      confidence: Math.min(1, Math.max(...pci.map((f) => f.confidence))),
      reason: `Cardholder data detected: ${pci.map((f) => f.type).join(', ')}`,
      citation: CITATIONS[ComplianceTag.PCI_DSS],
      evidence: pci.map((f) => `${f.type} (${f.validators.join('+')})`),
    });
  }

  const hipaa = piiOf(HIPAA_PII);
  if (hipaa.length >= 1) {
    const conf = Math.min(1, 0.4 + 0.15 * hipaa.length);
    hints.push({
      framework: ComplianceTag.HIPAA,
      confidence: conf,
      reason: `${hipaa.length} HIPAA safe-harbor identifier(s) — only authoritative when processed by a Covered Entity or Business Associate`,
      citation: CITATIONS[ComplianceTag.HIPAA],
      evidence: hipaa.map((f) => f.type),
    });
  }

  const gdprPii = piiOf(GDPR_PII);
  if (gdprPii.length > 0) {
    hints.push({
      framework: ComplianceTag.GDPR,
      confidence: Math.min(1, 0.5 + 0.1 * gdprPii.length),
      reason: `Personal data identifier(s) detected: ${gdprPii.map((f) => f.type).join(', ')} — GDPR applies only if data subject is in EU/EEA`,
      citation: CITATIONS[ComplianceTag.GDPR],
      evidence: gdprPii.map((f) => f.type),
    });
    hints.push({
      framework: ComplianceTag.CCPA,
      confidence: Math.min(1, 0.4 + 0.1 * gdprPii.length),
      reason: 'Personal information detected — CCPA applies only to qualifying California businesses',
      citation: CITATIONS[ComplianceTag.CCPA],
      evidence: gdprPii.map((f) => f.type),
    });
  }

  const ferpa = piiOf(FERPA_PII);
  if (ferpa.length > 0) {
    hints.push({
      framework: ComplianceTag.FERPA,
      confidence: Math.min(1, 0.4 + 0.2 * ferpa.length),
      reason: `Student record identifier(s): ${ferpa.map((f) => f.type).join(', ')} — FERPA applies only to educational institutions receiving federal funds`,
      citation: CITATIONS[ComplianceTag.FERPA],
      evidence: ferpa.map((f) => f.type),
    });
  }

  const dpdp = piiOf(DPDP_PII);
  if (dpdp.length > 0) {
    hints.push({
      framework: ComplianceTag.DPDP,
      confidence: Math.min(1, 0.5 + 0.1 * dpdp.length),
      reason: `Indian personal-data identifier(s): ${dpdp.map((f) => f.type).join(', ')}`,
      citation: CITATIONS[ComplianceTag.DPDP],
      evidence: dpdp.map((f) => f.type),
    });
  }

  const lowerName = input.toolName.toLowerCase();
  if (SOX_TOOL_HINTS.some((re) => re.test(lowerName))) {
    hints.push({
      framework: ComplianceTag.SOX,
      confidence: 0.55,
      reason: `Tool name suggests financial transaction (${lowerName})`,
      citation: CITATIONS[ComplianceTag.SOX],
      evidence: [`tool-name: ${input.toolName}`],
    });
  }

  const argStr = JSON.stringify(input.args ?? {}).toLowerCase();
  const gdprDomain = GDPR_DOMAINS.find((d) => new RegExp(`@[a-z0-9.-]+${d.replace('.', '\\.')}(?:[^a-z]|$)`).test(argStr));
  if (gdprDomain && !hints.some((h) => h.framework === ComplianceTag.GDPR)) {
    hints.push({
      framework: ComplianceTag.GDPR,
      confidence: 0.4,
      reason: `Recipient appears to be in EU/EEA (${gdprDomain})`,
      citation: CITATIONS[ComplianceTag.GDPR],
      evidence: [`domain-hint: ${gdprDomain}`],
    });
  }

  const tags = [...new Set(hints.map((h) => h.framework))];
  return { tags, hints, disclaimer: DISCLAIMER };
}

/** Backwards-compatible — returns the deduped tags only. */
export function tagCompliance(input: ComplianceInput): ComplianceTag[] {
  return evaluateRegulatoryHints(input).tags;
}

export function complianceSummary(tags: ComplianceTag[]): string {
  if (tags.length === 0) return 'no regulatory hints';
  return tags.join(', ');
}

export { DISCLAIMER as COMPLIANCE_DISCLAIMER };
