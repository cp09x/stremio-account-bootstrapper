import { describe, expect, it } from 'vitest';
import { decodeDataFromTransportUrl } from '../../utils/transportUrl';
import { configureComet, COMET_COMPACT_RESULT_FORMAT } from './comet';

const createPreset = () => ({
  comet: {
    transportUrl:
      'https://comet.feels.legal/eyJtYXhSZXN1bHRzUGVyUmVzb2x1dGlvbiI6MTAsIm1heFNpemUiOjAsImNhY2hlZE9ubHkiOmZhbHNlLCJyZXN1bHRGb3JtYXQiOlsiYWxsIl0sImRlYnJpZFNlcnZpY2VzIjpbXSwicmVzb2x1dGlvbnMiOnsicjQ4MHAiOnRydWUsInIzNjBwIjp0cnVlLCJyMjQwcCI6dHJ1ZSwidW5rbm93biI6dHJ1ZSwicjIxNjBwIjpmYWxzZX19/manifest.json',
    manifest: {
      name: 'Comet'
    }
  }
});

describe('configureComet', () => {
  it('keeps cached debrid results compact and reduces duplicate rows', () => {
    const presetConfig = createPreset();

    configureComet(presetConfig, {
      language: 'en',
      no4k: false,
      cached: true,
      limit: 10,
      size: 30,
      debridEntries: [
        { service: 'realdebrid', key: 'A'.repeat(52) },
        { service: 'torbox', key: '123e4567-e89b-12d3-a456-426614174000' }
      ],
      debridServiceName: 'RD + TB',
      preset: 'allinone',
      minQuality: '720p',
      excludeAnime: true
    });

    const encodedConfig = presetConfig.comet.transportUrl.match(
      /comet\.feels\.legal\/([^/]+)\/manifest\.json/
    )?.[1];

    expect(encodedConfig).toBeTruthy();
    const data = decodeDataFromTransportUrl(encodedConfig!);

    expect(data).toMatchObject({
      cachedOnly: true,
      maxResultsPerResolution: 5,
      maxSize: 32212254720,
      resultFormat: COMET_COMPACT_RESULT_FORMAT,
      resolutions: {
        r2160p: true,
        r576p: false,
        r480p: false,
        r360p: false,
        r240p: false,
        unknown: false
      }
    });
  });
});
