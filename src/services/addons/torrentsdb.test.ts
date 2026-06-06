import { describe, expect, it } from 'vitest';
import { decodeDataFromTransportUrl } from '../../utils/transportUrl';
import { configureTorrentsDB } from './torrentsdb';

const createPreset = () => ({
  torrentsdb: {
    transportUrl:
      'https://torrentsdb.com/eyJwcm92aWRlcnMiOlsieXRzIiwiZXp0diIsIjEzMzd4IiwidG9ycmVudGNzdiIsIm55YWEiLCJsaW1ldG9ycmVudCIsInJhcmdiIiwia25hYmVuIiwidGhlcGlyYXRlYmF5Iiwia2lja2Fzc3RvcnJlbnRzIiwiYW5pbWV0b3NobyIsInRva3lvdG9zaG8iLCJtYW51YWwiXSwicXVhbGl0eWZpbHRlciI6WyJzY3IiLCJjYW0iLCJ1bmtub3duIl0sImxpbWl0IjoiMTAifQ==/manifest.json',
    manifest: {
      name: 'TorrentsDB',
      types: ['movie', 'series', 'anime', 'other'],
      resources: [
        { name: 'stream', types: ['movie', 'series', 'anime'] },
        { name: 'catalog', types: ['anime'] }
      ],
      catalogs: [
        { type: 'movie', id: 'top', name: 'Top' },
        { type: 'anime', id: 'anime', name: 'Anime' }
      ]
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
    expect(decoded.providers).toEqual([
      'yts',
      'eztv',
      '1337x',
      'torrentcsv',
      'limetorrent',
      'rargb',
      'knaben',
      'thepiratebay',
      'kickasstorrents'
    ]);
    expect(decoded.providers).not.toContain('nyaa');
    expect(decoded.providers).not.toContain('animetosho');
    expect(decoded.providers).not.toContain('tokyotosho');
    expect(decoded.providers).not.toContain('manual');
    expect(presetConfig.torrentsdb.manifest.types).toEqual([
      'movie',
      'series',
      'other'
    ]);
    expect(presetConfig.torrentsdb.manifest.resources).toEqual([
      { name: 'stream', types: ['movie', 'series'] }
    ]);
    expect(presetConfig.torrentsdb.manifest.catalogs).toEqual([
      { type: 'movie', id: 'top', name: 'Top' }
    ]);
  });
});
