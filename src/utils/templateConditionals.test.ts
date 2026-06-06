import { describe, expect, it } from 'vitest';
import {
  applyTemplateConditionals,
  evaluateTemplateCondition,
  resolveCredentialRefs
} from './templateConditionals';

describe('AIOStreams template conditionals', () => {
  it('evaluates compound input and service conditions', () => {
    const inputs = {
      language: 'English',
      quality: 720,
      includeAddon: { subtitleLanguages: ['disabled'] }
    };

    expect(
      evaluateTemplateCondition(
        'inputs.language == English and inputs.quality >= 720',
        inputs,
        ['realdebrid']
      )
    ).toBe(true);
    expect(
      evaluateTemplateCondition(
        'services.realdebrid and !services.torbox',
        inputs,
        ['realdebrid']
      )
    ).toBe(true);
  });

  it('removes false conditional entries and preserves credential refs', () => {
    const template = {
      enabled: { __if: 'services.realdebrid', __value: true },
      dropped: { __if: 'services.torbox', __value: true },
      languages: '{{inputs.languages}}',
      credentials: '{{services.realdebrid.apiKey}}'
    };

    const applied = applyTemplateConditionals(
      template,
      { languages: ['English'] },
      ['realdebrid']
    );

    expect(applied).toEqual({
      enabled: true,
      languages: ['English'],
      credentials: '{{services.realdebrid.apiKey}}'
    });
    expect(
      resolveCredentialRefs(applied, {
        service_realdebrid_apiKey: 'A'.repeat(52)
      }).credentials
    ).toBe('A'.repeat(52));
  });
});
