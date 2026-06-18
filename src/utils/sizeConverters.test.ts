import { describe, expect, it } from 'vitest';
import { convertToBytes, convertToMegabytes } from './sizeConverters';

describe('convertToBytes', () => {
  it('converts a numeric value to bytes', () => {
    expect(convertToBytes(2)).toBe(2 * 1024 * 1024 * 1024);
  });

  it('converts a numeric string to bytes', () => {
    expect(convertToBytes('3')).toBe(3 * 1024 * 1024 * 1024);
  });

  it('returns 0 for a junk string instead of NaN', () => {
    expect(convertToBytes('not-a-number')).toBe(0);
  });
});

describe('convertToMegabytes', () => {
  it('converts a numeric value to megabytes', () => {
    expect(convertToMegabytes(2)).toBe(2 * 1024);
  });

  it('converts a numeric string to megabytes', () => {
    expect(convertToMegabytes('3')).toBe(3 * 1024);
  });

  it('returns 0 for a junk string instead of NaN', () => {
    expect(convertToMegabytes('garbage')).toBe(0);
  });
});
