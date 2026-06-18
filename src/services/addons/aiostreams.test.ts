import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  submittedConfig: undefined as any,
  getAddonConfig: vi.fn(),
  getTemplate: vi.fn()
}));

vi.mock('../../api/aioStreamsApi', () => ({
  getAddonConfig: mocks.getAddonConfig,
  getTemplate: mocks.getTemplate
}));

import { configureAioStreams } from './aiostreams';

const createPreset = (): any => ({
  aiostreams: {
    transportUrl: 'https://aiostreams.example/manifest.json',
    manifest: {
      name: 'AIOStreams'
    }
  }
});

const createTemplate = () => ({
  metadata: {
    inputs: [
      {
        id: 'sorting',
        type: 'subsection',
        subOptions: [{ id: 'library', type: 'select', default: 'default' }]
      }
    ]
  },
  config: {
    presets: [
      {
        type: 'opensubtitles-v3-plus',
        options: {
          language: '{{inputs.includeAddon.subtitleLanguages}}'
        }
      }
    ],
    titleMatching: { enabled: true },
    yearMatching: { enabled: true },
    bitrate: { useMetadataRuntime: true },
    // Mirrors the Tamtaro template: the Library Boost sort key is only present
    // when `inputs.sorting.library == high` resolves true via processTemplate.
    sortCriteria: {
      global: [
        {
          __if: 'inputs.sorting.library == high',
          key: 'library',
          direction: 'desc'
        }
      ]
    }
  }
});

describe('configureAioStreams', () => {
  beforeEach(() => {
    mocks.submittedConfig = undefined;
    mocks.getTemplate.mockResolvedValue(createTemplate());
    mocks.getAddonConfig.mockImplementation(async (config: any) => {
      mocks.submittedConfig = config;
      return {
        transportUrl: 'https://aiostreams.example/generated/manifest.json',
        manifest: {
          name: 'AIOStreams',
          resources: [
            'catalog',
            { name: 'stream', types: ['movie', 'series'] },
            { name: 'subtitles', types: ['movie', 'series'] }
          ],
          catalogs: [{ type: 'movie', id: 'search', name: 'Search' }]
        }
      };
    });
  });

  it('keeps title and year matching enabled without a TMDB API key', async () => {
    const presetConfig = createPreset();

    await configureAioStreams(presetConfig, {
      language: 'en',
      no4k: false,
      cached: true,
      limit: 10,
      size: 30,
      debridEntries: [{ service: 'realdebrid', key: 'A'.repeat(52) }],
      debridServiceName: 'RD',
      preset: 'allinone',
      password: 'secret',
      advanced: {},
      minQuality: '720p',
      excludeAnime: true
    });

    expect(mocks.submittedConfig.config.titleMatching).toEqual({
      enabled: true
    });
    expect(mocks.submittedConfig.config.yearMatching).toEqual({
      enabled: true
    });
    expect(mocks.submittedConfig.config.bitrate).toEqual({
      useMetadataRuntime: false
    });
    expect(mocks.submittedConfig.config.excludeUncached).toBe(true);
    expect(mocks.submittedConfig.config.preferredStreamTypes).toBeUndefined();
    expect(mocks.submittedConfig.config.cacheAndPlay).toBeUndefined();
    // Library Boost is gated on TorBox; with RD the high branch must not resolve.
    expect(mocks.submittedConfig.config.sortCriteria.global).toEqual([]);
    expect(mocks.submittedConfig.config.excludedResolutions).toContain('576p');
    expect(mocks.submittedConfig.config.coreFilter).toBe('extended');
    expect(mocks.submittedConfig.config.miscPassthrough).toMatchObject({
      overallTopQualRes: 12
    });
    expect(mocks.submittedConfig.config.deviceExclude).toEqual([
      'av1',
      'trueHD',
      'dts',
      'DVonly',
      'dvOnlyNonRemux',
      'DVP7'
    ]);
    expect(mocks.submittedConfig.config.languages).toEqual([
      'English',
      'Portuguese (Brazil)',
      'Portuguese'
    ]);
    expect(mocks.submittedConfig.config.LanguagePassthrough).toMatchObject({
      language: 'English',
      languageAmount: 10,
      subLanguage: 'English',
      subLanguageAmount: 10
    });
    expect(mocks.submittedConfig.config.presets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'opensubtitles-v3-plus',
          options: expect.objectContaining({
            language: ['disabled']
          })
        })
      ])
    );
    expect(mocks.submittedConfig.config.presets).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'webstreamr'
        })
      ])
    );
    expect(presetConfig.aiostreams.manifest.name).toBe('AIOStreams | RD');
    expect(presetConfig.aiostreams.manifest.resources).toEqual([
      { name: 'stream', types: ['movie', 'series'] }
    ]);
    expect(presetConfig.aiostreams.manifest.catalogs).toEqual([]);
  });

  it('prefers TorBox Usenet/Library copies and enables cacheAndPlay for torrents when TorBox is configured', async () => {
    const presetConfig = createPreset();

    await configureAioStreams(presetConfig, {
      language: 'en',
      no4k: false,
      cached: false,
      limit: 10,
      size: 30,
      debridEntries: [
        { service: 'torbox', key: '123e4567-e89b-12d3-a456-426614174000' }
      ],
      debridServiceName: 'TB',
      preset: 'allinone',
      password: 'secret',
      advanced: {},
      minQuality: 'any',
      excludeAnime: false
    });

    expect(mocks.submittedConfig.config.preferredStreamTypes).toEqual([
      'usenet',
      'debrid'
    ]);
    expect(mocks.submittedConfig.config.cacheAndPlay).toEqual({
      enabled: true,
      streamTypes: ['usenet', 'torrent']
    });
    // The high Library Boost sorting prop flowed through processTemplate, so the
    // template's `inputs.sorting.library == high` branch resolved and kept the
    // library sort key (pushing TorBox's owned/Library results to the top).
    expect(mocks.submittedConfig.config.sortCriteria.global).toEqual([
      { key: 'library', direction: 'desc' }
    ]);
  });
});
