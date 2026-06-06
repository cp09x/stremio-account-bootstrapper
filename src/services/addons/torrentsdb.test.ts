import { describe, expect, it } from 'vitest';
import { decodeDataFromTransportUrl } from '../../utils/transportUrl';
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

    const decoded = decodeDataFromTransportUrl(
      presetConfig.torrentsdb.transportUrl.split('/')[3]!
    ) as any;

    expect(decoded.debridoptions).toEqual(['nodownloadlinks', 'nocatalog']);
    expect(decoded.realdebrid).toBe('A'.repeat(52));
    expect(decoded.sort).toBe('qualitysize');
    expect(decoded.qualityfilter).toEqual([
      'scr',
      'cam',
      'unknown',
      '576p',
      '480p',
      '360p',
      '240p',
      '144p'
    ]);
    expect(decoded.providers).toEqual(['yts']);
  });
});
