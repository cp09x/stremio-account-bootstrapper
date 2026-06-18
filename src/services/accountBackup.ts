export const ACCOUNT_BACKUP_SCHEMA = 'stremio-account-bootstrapper.backup';
export const ACCOUNT_BACKUP_SCHEMA_VERSION = 2;

export type AccountBackupPlatform = 'stremio' | 'nuvio' | string;

export type AccountBackup = {
  schema: typeof ACCOUNT_BACKUP_SCHEMA;
  schemaVersion: typeof ACCOUNT_BACKUP_SCHEMA_VERSION;
  exportedAt: string;
  app: {
    name: string;
    version: string;
  };
  platform: AccountBackupPlatform;
  profileId?: number;
  containsSecrets: true;
  warnings: string[];
  payload: {
    addons: any[];
    addonCount: number;
    addonNames: string[];
  };
};

export type BackupParseResult = {
  addons: any[];
  sourceFormat: 'versioned' | 'stremio-api-response' | 'raw-addons-array';
  metadata?: {
    exportedAt?: string;
    platform?: AccountBackupPlatform;
    schemaVersion?: number;
    addonCount?: number;
    addonNames?: string[];
    containsSecrets?: boolean;
  };
};

const SECRET_WARNING =
  'This backup contains configured addon URLs and may include debrid/API keys. Store it like a password file.';

const getAddonName = (addon: any): string =>
  addon?.manifest?.name ||
  addon?.name ||
  addon?.transportUrl ||
  addon?.url ||
  'Addon';

const normalizeAddon = (addon: any): any => {
  if (!addon || typeof addon !== 'object') {
    throw new Error('Backup contains an invalid addon entry');
  }

  const transportUrl = addon.transportUrl || addon.url;
  if (typeof transportUrl !== 'string' || transportUrl.trim() === '') {
    throw new Error('Backup contains an addon without a manifest URL');
  }

  return addon;
};

export function normalizeBackupAddons(addons: unknown): any[] {
  if (!Array.isArray(addons)) {
    throw new Error('Backup file does not contain an addons array');
  }

  if (addons.length === 0) {
    throw new Error('Backup file contains no addons');
  }

  return addons.map(normalizeAddon);
}

export function createAccountBackup({
  addonCollection,
  platform,
  profileId,
  exportedAt = new Date(),
  appVersion = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'
}: {
  addonCollection: any;
  platform: AccountBackupPlatform;
  profileId?: number;
  exportedAt?: Date;
  appVersion?: string;
}): AccountBackup {
  const addons = normalizeBackupAddons(
    addonCollection?.result?.addons ??
      addonCollection?.addons ??
      addonCollection
  );

  return {
    schema: ACCOUNT_BACKUP_SCHEMA,
    schemaVersion: ACCOUNT_BACKUP_SCHEMA_VERSION,
    exportedAt: exportedAt.toISOString(),
    app: {
      name: 'stremio-account-bootstrapper',
      version: appVersion
    },
    platform,
    ...(profileId ? { profileId } : {}),
    containsSecrets: true,
    warnings: [SECRET_WARNING],
    payload: {
      addons,
      addonCount: addons.length,
      addonNames: addons.map(getAddonName)
    }
  };
}

export function parseAccountBackup(parsed: unknown): BackupParseResult {
  if (Array.isArray(parsed)) {
    const addons = normalizeBackupAddons(parsed);
    return {
      addons,
      sourceFormat: 'raw-addons-array',
      metadata: {
        addonCount: addons.length,
        addonNames: addons.map(getAddonName)
      }
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid backup file');
  }

  const candidate = parsed as any;

  if (candidate.schema === ACCOUNT_BACKUP_SCHEMA) {
    const addons = normalizeBackupAddons(candidate.payload?.addons);
    return {
      addons,
      sourceFormat: 'versioned',
      metadata: {
        exportedAt: candidate.exportedAt,
        platform: candidate.platform,
        schemaVersion: candidate.schemaVersion,
        addonCount: addons.length,
        addonNames: candidate.payload?.addonNames || addons.map(getAddonName),
        containsSecrets: Boolean(candidate.containsSecrets)
      }
    };
  }

  const apiAddons = candidate.result?.addons ?? candidate.addons;
  if (apiAddons) {
    const addons = normalizeBackupAddons(apiAddons);
    return {
      addons,
      sourceFormat: 'stremio-api-response',
      metadata: {
        addonCount: addons.length,
        addonNames: addons.map(getAddonName)
      }
    };
  }

  throw new Error('Invalid backup file');
}

export function buildBackupFilename({
  platform,
  prefix = 'account-backup',
  exportedAt = new Date()
}: {
  platform: AccountBackupPlatform;
  prefix?: string;
  exportedAt?: Date;
}): string {
  const timestamp = exportedAt.toISOString().replace(/[:.]/g, '-');
  return `${platform}-${prefix}-${timestamp}.private.json`;
}
