import { describe, expect, test } from 'vitest';
import { abaValid, ibanValid, luhnValid, nhsValid, panValid, ssnValid, verhoeffValid } from '../validators.js';

describe('luhn', () => {
  test('accepts real Visa', () => expect(luhnValid('4111111111111111')).toBe(true));
  test('accepts real Mastercard', () => expect(luhnValid('5555555555554444')).toBe(true));
  test('accepts Amex 15-digit', () => expect(luhnValid('378282246310005')).toBe(true));
  // NOTE: all-zero IS a mathematically valid Luhn (sum=0, 0 mod 10 = 0).
  // We rely on the PII detector's context-window check to suppress this as
  // a credit-card finding when there's no contextual evidence (no "card"
  // keyword nearby), so the validator alone returns true.
  test('all-zero passes Luhn (but is filtered downstream by context)', () => expect(luhnValid('0000000000000000')).toBe(true));
  test('rejects sequential', () => expect(luhnValid('1234567890123456')).toBe(false));
  test('rejects short input', () => expect(luhnValid('411')).toBe(false));
  test('rejects non-digits', () => expect(luhnValid('411111111111111a')).toBe(false));
  test('accepts hyphens', () => expect(luhnValid('4111-1111-1111-1111')).toBe(true));
  test('accepts spaces', () => expect(luhnValid('4111 1111 1111 1111')).toBe(true));
});

describe('verhoeff (Aadhaar)', () => {
  test('accepts a known-valid Aadhaar', () => expect(verhoeffValid('234123412346')).toBe(true));
  test('rejects 12 random digits', () => expect(verhoeffValid('123456789012')).toBe(false));
  test('rejects all zeros', () => expect(verhoeffValid('000000000000')).toBe(false));
  test('rejects 11 digits', () => expect(verhoeffValid('23412341234')).toBe(false));
  test('accepts spaced format', () => expect(verhoeffValid('2341 2341 2346')).toBe(true));
});

describe('iban mod-97', () => {
  test('accepts UK', () => expect(ibanValid('GB82 WEST 1234 5698 7654 32')).toBe(true));
  test('accepts DE', () => expect(ibanValid('DE89 3704 0044 0532 0130 00')).toBe(true));
  test('accepts FR', () => expect(ibanValid('FR1420041010050500013M02606')).toBe(true));
  test('rejects bad check digits', () => expect(ibanValid('GB00 WEST 1234 5698 7654 32')).toBe(false));
  test('rejects non-iban garbage', () => expect(ibanValid('NOT-AN-IBAN')).toBe(false));
});

describe('aba routing', () => {
  test('accepts a known-good ABA', () => expect(abaValid('111000025')).toBe(true));
  test('rejects bad checksum', () => expect(abaValid('111000026')).toBe(false));
  test('rejects wrong length', () => expect(abaValid('11100002')).toBe(false));
});

describe('nhs mod-11', () => {
  test('accepts a generated valid', () => expect(nhsValid('9434765919')).toBe(true));
  test('rejects bad checksum', () => expect(nhsValid('9434765910')).toBe(false));
  test('rejects 9-digit', () => expect(nhsValid('943476591')).toBe(false));
});

describe('pan (India) format', () => {
  test('accepts canonical', () => expect(panValid('ABCDE1234F')).toBe(true));
  test('rejects lowercase', () => expect(panValid('abcde1234f')).toBe(false));
  test('rejects bad shape', () => expect(panValid('AB12345CDE')).toBe(false));
});

describe('ssn sanity', () => {
  test('accepts valid blocks', () => expect(ssnValid('123-45-6789')).toBe(true));
  test('rejects 666 area', () => expect(ssnValid('666-45-6789')).toBe(false));
  test('rejects area >= 900', () => expect(ssnValid('900-45-6789')).toBe(false));
  test('rejects area 000', () => expect(ssnValid('000-45-6789')).toBe(false));
  test('rejects group 00', () => expect(ssnValid('123-00-6789')).toBe(false));
  test('rejects serial 0000', () => expect(ssnValid('123-45-0000')).toBe(false));
  test('rejects malformed', () => expect(ssnValid('1234-56-7890')).toBe(false));
});
