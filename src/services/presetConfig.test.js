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
      'torrentsdb',
      'streailer',
      'opensubtitlespro'
    ]);
    expect(presetData.presets.allinone).not.toContain('comet');
    expect(presetData.presets.allinone).not.toContain('torrentio');
    expect(presetData.presets.allinone).not.toContain('guindex');
  });

  it('does not contain the misspelled Dutch AniDex provider token', () => {
    const serialized = JSON.stringify(presetData);

    expect(serialized).not.toContain('aanidex');
    expect(serialized).toContain('anidex');
  });
});
