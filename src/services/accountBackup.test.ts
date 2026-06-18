import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_BACKUP_SCHEMA,
  createAccountBackup,
  parseAccountBackup
} from './accountBackup';

const addon = {
  transportUrl: 'https://example.com/manifest.json',
  manifest: {
    name: 'Example Addon'
  }
};

describe('accountBackup', () => {
  it('creates a versioned backup with addon metadata', () => {
    const backup = createAccountBackup({
      addonCollection: { result: { addons: [addon] } },
      platform: 'stremio',
      exportedAt: new Date('2026-06-06T19:00:00.000Z'),
      appVersion: 'test'
    });

    expect(backup.schema).toBe(ACCOUNT_BACKUP_SCHEMA);
    expect(backup.exportedAt).toBe('2026-06-06T19:00:00.000Z');
    expect(backup.platform).toBe('stremio');
    expect(backup.containsSecrets).toBe(true);
    expect(backup.payload.addonCount).toBe(1);
    expect(backup.payload.addonNames).toEqual(['Example Addon']);
  });

  it('parses versioned and legacy backup formats', () => {
    const backup = createAccountBackup({
      addonCollection: [addon],
      platform: 'stremio'
    });

    expect(parseAccountBackup(backup)).toMatchObject({
      addons: [addon],
      sourceFormat: 'versioned',
      metadata: {
        platform: 'stremio',
        addonCount: 1,
        addonNames: ['Example Addon'],
        containsSecrets: true
      }
    });

    expect(parseAccountBackup({ result: { addons: [addon] } })).toMatchObject({
      addons: [addon],
      sourceFormat: 'stremio-api-response'
    });

    expect(parseAccountBackup([addon])).toMatchObject({
      addons: [addon],
      sourceFormat: 'raw-addons-array'
    });
  });

  it('rejects backups without addon manifest URLs', () => {
    expect(() =>
      parseAccountBackup([{ manifest: { name: 'Broken' } }])
    ).toThrow('Backup contains an addon without a manifest URL');
  });
});
