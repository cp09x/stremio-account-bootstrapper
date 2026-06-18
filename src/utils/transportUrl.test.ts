import { Buffer } from 'buffer';
import { describe, expect, it } from 'vitest';
import {
  decodeDataFromTransportUrl,
  getDataTransportUrl
} from './transportUrl';

const sample = { foo: 'bar', n: 42 };
const encoded = Buffer.from(JSON.stringify(sample)).toString('base64');

describe('decodeDataFromTransportUrl', () => {
  it('decodes valid base64-encoded JSON', () => {
    expect(decodeDataFromTransportUrl(encoded)).toEqual(sample);
  });

  it('throws a descriptive error on malformed JSON', () => {
    const badJson = Buffer.from('{not json').toString('base64');
    expect(() => decodeDataFromTransportUrl(badJson)).toThrow(
      /Failed to parse transport URL data as JSON/
    );
  });
});

describe('getDataTransportUrl', () => {
  it('decodes a valid transport URL', () => {
    const url = `https://example.com/${encoded}/manifest.json`;
    const result = getDataTransportUrl(url);
    expect(result.domain).toBe('https://example.com/');
    expect(result.data).toEqual(sample);
    expect(result.manifest).toBe('/manifest.json');
  });

  it('throws a descriptive error for a URL that does not match', () => {
    expect(() =>
      getDataTransportUrl('https://example.com/no-manifest')
    ).toThrow(/Invalid transport URL/);
  });

  it('throws a descriptive (non-opaque) error for malformed base64 data', () => {
    const badPayload = Buffer.from('{broken').toString('base64');
    const url = `https://example.com/${badPayload}/manifest.json`;
    expect(() => getDataTransportUrl(url)).toThrow(
      /Failed to parse transport URL data as JSON/
    );
  });
});
