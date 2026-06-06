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
    inputs: []
  },
  config: {
    presets: [],
    titleMatching: { enabled: true },
    yearMatching: { enabled: true },
    bitrate: { useMetadataRuntime: true }
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
            { name: 'stream', types: ['movie', 'series'] }
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
    expect(mocks.submittedConfig.config.excludedResolutions).toContain('576p');
    expect(presetConfig.aiostreams.manifest.name).toBe('AIOStreams | RD');
    expect(presetConfig.aiostreams.manifest.resources).toEqual([
      { name: 'stream', types: ['movie', 'series'] }
    ]);
    expect(presetConfig.aiostreams.manifest.catalogs).toEqual([]);
  });
});
