import { describe, expect, it } from 'vitest';
import { configureGuIndex } from './guindex';

const createPreset = () => ({
  guindex: {
    transportUrl: 'https://guindex-stremio.vercel.app/manifest.json',
    manifest: {
      name: 'GuIndex'
    }
  }
});

const createContext = (
  debridEntries: any[],
  overrides: Record<string, any> = {}
) => ({
  language: 'pt-BR',
  no4k: false,
  cached: false,
  limit: 10,
  size: '',
  debridEntries,
  debridServiceName: debridEntries
    .map((debrid) => (debrid.service === 'realdebrid' ? 'RD' : 'TB'))
    .join(' + '),
  preset: 'allinone',
  minQuality: 'any' as const,
  excludeAnime: true,
  ...overrides
});

describe('configureGuIndex', () => {
  it('generates separate Real-Debrid and TorBox configs', () => {
    const presetConfig = createPreset();

    const result = configureGuIndex(
      presetConfig,
      createContext([
        { service: 'realdebrid', key: 'A'.repeat(52) },
        { service: 'torbox', key: '123e4567-e89b-12d3-a456-426614174000' }
      ])
    );

    expect(result.shouldReplace).toBe(true);
    expect(Object.keys(result.rebuilt ?? {})).toEqual([
      'guindex_realdebrid',
      'guindex_torbox'
    ]);
    expect(result.rebuilt?.guindex_realdebrid.transportUrl).toContain(
      `realdebrid/${'A'.repeat(52)}/manifest.json`
    );
    expect(result.rebuilt?.guindex_realdebrid.manifest.name).toBe(
      'GuIndex BR | RD'
    );
    expect(result.rebuilt?.guindex_torbox.transportUrl).toContain(
      'torbox/123e4567-e89b-12d3-a456-426614174000/manifest.json'
    );
    expect(result.rebuilt?.guindex_torbox.manifest.name).toBe(
      'GuIndex BR | TB'
    );
  });

  it('removes GuIndex without Real-Debrid or TorBox credentials', () => {
    const presetConfig = createPreset();

    const result = configureGuIndex(
      presetConfig,
      createContext([{ service: 'debridlink', key: 'DL-KEY' }])
    );

    expect(result.shouldReplace).toBe(false);
    expect(presetConfig.guindex).toBeUndefined();
  });

  it('removes GuIndex when strict stream filters are requested', () => {
    const presetConfig = createPreset();

    const result = configureGuIndex(
      presetConfig,
      createContext([{ service: 'realdebrid', key: 'A'.repeat(52) }], {
        cached: true,
        minQuality: '720p'
      })
    );

    expect(result.shouldReplace).toBe(false);
    expect(presetConfig.guindex).toBeUndefined();
  });
});
