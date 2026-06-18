import { describe, expect, it } from 'vitest';
import { isValidApiKey } from './debrid';

describe('isValidApiKey', () => {
  it('accepts valid Real-Debrid and TorBox keys', () => {
    expect(isValidApiKey('realdebrid', 'A'.repeat(52))).toBe(true);
    expect(
      isValidApiKey('torbox', '123e4567-e89b-12d3-a456-426614174000')
    ).toBe(true);
  });

  it('rejects keys that do not match the selected provider format', () => {
    expect(
      isValidApiKey('realdebrid', '123e4567-e89b-12d3-a456-426614174000')
    ).toBe(false);
    expect(isValidApiKey('torbox', 'A'.repeat(52))).toBe(false);
    expect(isValidApiKey('realdebrid', '')).toBe(false);
  });

  it('accepts a 52-char Real-Debrid token containing lowercase chars', () => {
    const token = ('abc123' + 'A'.repeat(46)).slice(0, 52);
    expect(token).toHaveLength(52);
    expect(isValidApiKey('realdebrid', token)).toBe(true);
  });

  it('rejects Real-Debrid tokens with the wrong length', () => {
    expect(isValidApiKey('realdebrid', 'a'.repeat(51))).toBe(false);
    expect(isValidApiKey('realdebrid', 'a'.repeat(53))).toBe(false);
  });
});
