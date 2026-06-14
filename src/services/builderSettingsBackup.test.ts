import { describe, expect, it } from 'vitest';
import {
  BUILDER_SETTINGS_BACKUP_SCHEMA,
  createBuilderSettingsBackup,
  isBuilderSettingsBackup,
  parseBuilderSettingsBackup
} from './builderSettingsBackup';

const settings = {
  preset: 'allinone',
  language: 'en',
  debridEntries: [
    { service: 'realdebrid', key: 'A'.repeat(52) },
    { service: 'torbox', key: '123e4567-e89b-12d3-a456-426614174000' }
  ],
  extras: ['stremthrustore'],
  customAddons: ['https://example.com/manifest.json'],
  options: ['cached', 'min720p', 'excludeAnime'],
  maxSize: 30,
  advancedOptions: {
    tmdbKey: 'tmdb',
    unknown: 'kept'
  }
};

describe('builderSettingsBackup', () => {
  it('creates and parses settings backups with private keys intact', () => {
    const backup = createBuilderSettingsBackup({
      settings,
      exportedAt: new Date('2026-06-14T10:00:00.000Z'),
      appVersion: 'test'
    });

    expect(backup.schema).toBe(BUILDER_SETTINGS_BACKUP_SCHEMA);
    expect(backup.containsSecrets).toBe(true);
    expect(backup.exportedAt).toBe('2026-06-14T10:00:00.000Z');
    expect(isBuilderSettingsBackup(backup)).toBe(true);
    expect(parseBuilderSettingsBackup(backup)).toMatchObject(settings);
  });

  it('normalizes partial legacy settings objects', () => {
    expect(
      parseBuilderSettingsBackup({
        builderSettings: {
          debridEntries: [{ service: 'torbox', key: 'abc' }]
        }
      })
    ).toMatchObject({
      preset: 'allinone',
      language: 'en',
      debridEntries: [{ service: 'torbox', key: 'abc' }]
    });
  });

  it('rejects account addon backups as builder settings', () => {
    const accountBackup = {
      schema: 'stremio-account-bootstrapper.backup',
      payload: { addons: [] }
    };

    expect(isBuilderSettingsBackup(accountBackup)).toBe(false);
    expect(() => parseBuilderSettingsBackup(accountBackup)).toThrow(
      'Invalid builder settings file'
    );
  });
});
