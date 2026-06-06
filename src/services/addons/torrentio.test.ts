import { describe, expect, it } from 'vitest';
import * as Sqrl from 'squirrelly';
import { configureTorrentio } from './torrentio';

const createPreset = () => ({
  torrentio: {
    transportUrl:
      'https://torrentio.strem.fun/providers=yts|qualityfilter={{it.no4k}}scr,cam,unknown{{it.maxSize}}|limit={{it.limit}}{{it.transportUrl}}/manifest.json',
    manifest: {
      name: 'Torrentio'
    }
  }
});

describe('configureTorrentio', () => {
  it('generates cached debrid configs for Real-Debrid and TorBox', () => {
    const presetConfig = createPreset();

    const result = configureTorrentio(
      presetConfig,
      {
        language: 'en',
        no4k: true,
        cached: true,
        limit: 10,
        size: 30,
        debridEntries: [
          { service: 'realdebrid', key: 'A'.repeat(52) },
          { service: 'torbox', key: '123e4567-e89b-12d3-a456-426614174000' }
        ],
        debridServiceName: 'RD + TB',
        preset: 'standard',
        minQuality: '720p',
        excludeAnime: true
      },
      Sqrl
    );

    expect(result.shouldReplace).toBe(true);
    expect(Object.keys(result.rebuilt ?? {})).toEqual([
      'torrentio_realdebrid',
      'torrentio_torbox'
    ]);
    expect(result.rebuilt.torrentio_realdebrid.transportUrl).toContain(
      'debridoptions=nodownloadlinks,nocatalog'
    );
    expect(result.rebuilt.torrentio_realdebrid.transportUrl).toContain(
      `realdebrid=${'A'.repeat(52)}`
    );
    expect(result.rebuilt.torrentio_torbox.transportUrl).toContain(
      'torbox=123e4567-e89b-12d3-a456-426614174000'
    );
    expect(result.rebuilt.torrentio_realdebrid.transportUrl).toContain(
      'qualityfilter=4k,scr,cam,unknown,480p,360p,240p,144p'
    );
    expect(result.rebuilt.torrentio_realdebrid.transportUrl).toContain(
      'sizefilter=30GB'
    );
  });
});
