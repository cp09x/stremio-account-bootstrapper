import { describe, expect, it } from 'vitest';
import { Buffer } from 'buffer';
import { configureTorrentsDB } from './torrentsdb';

const createPreset = () => ({
  torrentsdb: {
    transportUrl:
      'https://torrentsdb.com/eyJwcm92aWRlcnMiOlsieXRzIiwibnlhYSIsImFuaW1ldG9zaG8iXSwicXVhbGl0eWZpbHRlciI6WyJzY3IiLCJjYW0iLCJ1bmtub3duIl0sImxpbWl0IjoiMTAifQ==/manifest.json',
    manifest: {
      name: 'TorrentsDB'
    }
  }
});

describe('configureTorrentsDB', () => {
  it('hides download links for cached debrid configs', () => {
    const presetConfig = createPreset();

    configureTorrentsDB(presetConfig, {
      language: 'en',
      no4k: false,
      cached: true,
      limit: 10,
      size: 30,
      debridEntries: [{ service: 'realdebrid', key: 'A'.repeat(52) }],
      debridServiceName: 'Real-Debrid',
      preset: 'allinone',
      minQuality: '720p',
      excludeAnime: true
    });

    const decoded = Buffer.from(
      presetConfig.torrentsdb.transportUrl.split('/')[3]!,
      'base64'
    ).toString('utf-8');

    expect(decoded).toContain(
      '"debridoptions":["nodownloadlinks","nocatalog"]'
    );
    expect(decoded).toContain(`"realdebrid":"${'A'.repeat(52)}"`);
    expect(decoded).toContain('"sort":"qualitysize"');
    expect(decoded).not.toContain('nyaa');
    expect(decoded).not.toContain('animetosho');
  });
});
