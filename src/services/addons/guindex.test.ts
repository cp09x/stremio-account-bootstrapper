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

const createContext = (debridEntries: any[]) => ({
  language: 'pt-BR',
  no4k: false,
  cached: true,
  limit: 10,
  size: 30,
  debridEntries,
  debridServiceName: debridEntries
    .map((debrid) => (debrid.service === 'realdebrid' ? 'RD' : 'TB'))
    .join(' + '),
  preset: 'allinone',
  minQuality: '720p' as const,
  excludeAnime: true
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
      'GuIndex | RD'
    );
    expect(result.rebuilt?.guindex_torbox.transportUrl).toContain(
      'torbox/123e4567-e89b-12d3-a456-426614174000/manifest.json'
    );
    expect(result.rebuilt?.guindex_torbox.manifest.name).toBe('GuIndex | TB');
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
});
