import { describe, expect, it } from 'vitest';
import { encodeDataFromTransportUrl } from '../utils/transportUrl';
import { extractBuilderSettingsFromAddons } from './builderSettingsFromAddons';

const rdKey = 'A'.repeat(52);
const torboxKey = '123e4567-e89b-12d3-a456-426614174000';

describe('extractBuilderSettingsFromAddons', () => {
  it('extracts Torrentio pipe config debrid keys', () => {
    const result = extractBuilderSettingsFromAddons([
      {
        transportUrl: `https://torrentio.strem.fun/providers=1337x|realdebrid=${rdKey}|torbox=${torboxKey}/manifest.json`
      }
    ]);

    expect(result.debridEntries).toEqual([
      { service: 'realdebrid', key: rdKey },
      { service: 'torbox', key: torboxKey }
    ]);
    expect(result.settings.debridEntries).toEqual(result.debridEntries);
  });

  it('extracts TorrentsDB base64 JSON config debrid keys', () => {
    const data = encodeDataFromTransportUrl({
      providers: ['1337x'],
      realdebrid: rdKey,
      torbox: torboxKey
    });
    const result = extractBuilderSettingsFromAddons([
      {
        transportUrl: `https://torrentsdb.com/${data}/manifest.json`
      }
    ]);

    expect(result.debridEntries).toEqual([
      { service: 'realdebrid', key: rdKey },
      { service: 'torbox', key: torboxKey }
    ]);
  });

  it('extracts Comet debridServices base64 JSON config keys', () => {
    const data = encodeDataFromTransportUrl({
      debridServices: [
        { service: 'torbox', apiKey: torboxKey },
        { service: 'realdebrid', apiKey: rdKey }
      ]
    });
    const result = extractBuilderSettingsFromAddons([
      {
        transportUrl: `https://comet.feels.legal/${data}/manifest.json`
      }
    ]);

    expect(result.debridEntries).toEqual([
      { service: 'torbox', key: torboxKey },
      { service: 'realdebrid', key: rdKey }
    ]);
  });

  it('extracts GuIndex path keys', () => {
    const result = extractBuilderSettingsFromAddons([
      {
        transportUrl: `https://guindex-stremio.vercel.app/torbox/${torboxKey}/manifest.json`
      }
    ]);

    expect(result.debridEntries).toEqual([
      { service: 'torbox', key: torboxKey }
    ]);
  });

  it('returns default blank settings when an account backup has no recoverable keys', () => {
    const result = extractBuilderSettingsFromAddons([
      {
        transportUrl: 'https://v3-cinemeta.strem.io/manifest.json'
      }
    ]);

    expect(result.debridEntries).toEqual([]);
    expect(result.settings.debridEntries).toEqual([{ service: '', key: '' }]);
  });
});
