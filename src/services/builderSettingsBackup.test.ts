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
  },
  password: 'super-secret-password'
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

  it('round-trips the generated password through export/import', () => {
    const backup = createBuilderSettingsBackup({
      settings: { ...settings, password: 'AbC123!@#xyz' },
      appVersion: 'test'
    });

    expect(backup.payload.password).toBe('AbC123!@#xyz');
    expect(parseBuilderSettingsBackup(backup).password).toBe('AbC123!@#xyz');
  });

  it('defaults password to empty string when absent', () => {
    expect(
      parseBuilderSettingsBackup({
        builderSettings: { preset: 'allinone' }
      }).password
    ).toBe('');
  });

  it('drops half-filled debrid entries (missing service or key)', () => {
    const result = parseBuilderSettingsBackup({
      builderSettings: {
        debridEntries: [
          { service: 'realdebrid', key: '' },
          { service: '', key: 'orphan-key' },
          { service: 'torbox', key: 'abc' }
        ]
      }
    });

    expect(result.debridEntries).toEqual([{ service: 'torbox', key: 'abc' }]);
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
