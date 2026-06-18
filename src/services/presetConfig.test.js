import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const presetData = JSON.parse(
  readFileSync(new URL('../../public/preset.json', import.meta.url), 'utf-8')
);

describe('preset configuration', () => {
  it('keeps the all-in-one stream stack strict and ordered', () => {
    expect(presetData.presets.allinone).toEqual([
      'cinemeta',
      'aiometadata',
      'aiostreams',
      'torrentio_br',
      'torrentsdb',
      'streailer',
      'opensubtitlespro',
      'opensubtitlesv2',
      'opensubtitlesv3',
      'subherov2'
    ]);
    expect(presetData.presets.allinone).not.toContain('comet');
    expect(presetData.presets.allinone).not.toContain('guindex');
    expect(presetData.presets.allinone).not.toContain('torrentio');
  });

  it('adds a narrow Brazilian Torrentio fallback without broad public providers', () => {
    const torrentioUrl = presetData.languages.en.torrentio_br.transportUrl;

    expect(torrentioUrl).toContain('comando');
    expect(torrentioUrl).toContain('bludv');
    expect(torrentioUrl).toContain('micoleaodublado');
    expect(torrentioUrl).toContain('language=portuguese');
    expect(torrentioUrl).not.toContain('1337x');
    expect(torrentioUrl).not.toContain('thepiratebay');
  });

  it('configures English subtitles with English and Brazilian Portuguese fallback', () => {
    const opensubtitlesPro = presetData.languages.en.opensubtitlespro;
    const encodedConfig = opensubtitlesPro.transportUrl.split('/')[3];
    const decodedConfig = JSON.parse(
      Buffer.from(encodedConfig, 'base64').toString('utf-8')
    );

    expect(decodedConfig.langs).toEqual(['english', 'portuguese-br']);
  });

  it('keeps official OpenSubtitles v2 as a resilient subtitle fallback', () => {
    const opensubtitlesV2 = presetData.languages.en.opensubtitlesv2;

    expect(opensubtitlesV2.transportUrl).toBe(
      'https://subtitlesv2.strem.io/manifest.json'
    );
    expect(opensubtitlesV2.manifest.resources).toEqual(['subtitles']);
    expect(opensubtitlesV2.manifest.id).toBe('community.opensubtitlesv2');
  });

  it('does not contain the misspelled Dutch AniDex provider token', () => {
    const serialized = JSON.stringify(presetData);

    expect(serialized).not.toContain('aanidex');
    expect(serialized).toContain('anidex');
  });
});
