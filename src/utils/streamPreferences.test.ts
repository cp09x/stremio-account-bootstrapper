import { describe, expect, it } from 'vitest';
import {
  applyManifestContentPreferences,
  applyStreamOnlyManifest,
  applyTorrentioPreferences,
  filterResolutionsByMinQuality,
  getCometResolutionOverrides,
  getExcludedResolutions
} from './streamPreferences';

describe('stream preferences', () => {
  it('maps 720p minimum quality to addon-specific resolution filters', () => {
    expect(getExcludedResolutions('720p')).toEqual([
      '576p',
      '480p',
      '360p',
      '240p',
      '144p',
      'Unknown'
    ]);
    expect(getCometResolutionOverrides('720p')).toEqual({
      r480p: false,
      r360p: false,
      r240p: false,
      unknown: false
    });
    expect(
      filterResolutionsByMinQuality(['4k', '1080p', '720p', '480p'], '720p')
    ).toEqual(['4k', '1080p', '720p']);
  });

  it('adds low-quality filters and removes anime-focused Torrentio providers', () => {
    const url =
      'https://torrentio.strem.fun/providers=yts,nyaasi,tokyotosho,eztv|qualityfilter=scr,cam,unknown|limit=10/manifest.json';

    expect(
      applyTorrentioPreferences(url, {
        minQuality: '720p',
        excludeAnime: true
      })
    ).toBe(
      'https://torrentio.strem.fun/providers=yts,eztv|qualityfilter=scr,cam,unknown,480p,360p,240p,144p|limit=10/manifest.json'
    );
  });

  it('removes anime and hentai metadata from generated manifests', () => {
    const manifest = {
      types: ['movie', 'series', 'anime', 'hentai'],
      resources: [
        {
          name: 'stream',
          types: ['movie', 'anime'],
          idPrefixes: ['tt', 'kitsu:']
        }
      ],
      catalogs: [
        { type: 'movie', id: 'top', name: 'Top Movies' },
        { type: 'anime', id: 'kitsu.popular', name: 'Popular Anime' }
      ]
    };

    applyManifestContentPreferences(manifest, { excludeAnime: true });

    expect(manifest).toEqual({
      types: ['movie', 'series'],
      resources: [
        {
          name: 'stream',
          types: ['movie'],
          idPrefixes: ['tt']
        }
      ],
      catalogs: [{ type: 'movie', id: 'top', name: 'Top Movies' }]
    });
  });

  it('keeps aggregator manifests stream-only when catalog metadata is not wanted', () => {
    const manifest = {
      resources: [
        'catalog',
        'meta',
        { name: 'stream', types: ['movie', 'series'] },
        { name: 'subtitles' }
      ],
      catalogs: [{ type: 'movie', id: 'search', name: 'Search' }],
      addonCatalogs: [{ type: 'movie', id: 'community', name: 'Community' }]
    };

    applyStreamOnlyManifest(manifest);

    expect(manifest).toEqual({
      resources: [{ name: 'stream', types: ['movie', 'series'] }],
      catalogs: [],
      addonCatalogs: []
    });
  });
});
