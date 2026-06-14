export const BUILDER_SETTINGS_BACKUP_SCHEMA =
  'stremio-account-bootstrapper.builder-settings';
export const BUILDER_SETTINGS_BACKUP_SCHEMA_VERSION = 1;

export type BuilderSettings = {
  preset: string;
  language: string;
  debridEntries: Array<{ service: string; key: string }>;
  extras: string[];
  customAddons: string[];
  options: string[];
  maxSize: string | number;
  advancedOptions: Record<string, string>;
};

export type BuilderSettingsBackup = {
  schema: typeof BUILDER_SETTINGS_BACKUP_SCHEMA;
  schemaVersion: typeof BUILDER_SETTINGS_BACKUP_SCHEMA_VERSION;
  exportedAt: string;
  app: {
    name: string;
    version: string;
  };
  containsSecrets: true;
  warnings: string[];
  payload: BuilderSettings;
};

const SECRET_WARNING =
  'This backup contains visible builder settings and may include debrid/API keys. Store it like a password file.';

const DEFAULT_SETTINGS: BuilderSettings = {
  preset: 'allinone',
  language: 'en',
  debridEntries: [{ service: '', key: '' }],
  extras: [],
  customAddons: [''],
  options: ['cached', 'min720p', 'excludeAnime'],
  maxSize: '',
  advancedOptions: {
    rpdbKey: '',
    tmdbKey: '',
    tmdbAccessToken: '',
    tvdbKey: '',
    fanartKey: '',
    geminiKey: '',
    topPosterKey: '',
    mdblistKey: '',
    publicMetaDbKey: ''
  }
};

const stringArray = (value: unknown, fallback: string[] = []): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : fallback;

const normalizeDebridEntries = (
  value: unknown
): BuilderSettings['debridEntries'] => {
  if (!Array.isArray(value)) {
    return DEFAULT_SETTINGS.debridEntries;
  }

  const entries = value
    .map((entry) => ({
      service: typeof entry?.service === 'string' ? entry.service : '',
      key: typeof entry?.key === 'string' ? entry.key : ''
    }))
    .filter((entry) => entry.service || entry.key);

  return entries.length > 0 ? entries : DEFAULT_SETTINGS.debridEntries;
};

export function normalizeBuilderSettings(value: unknown): BuilderSettings {
  const candidate = value && typeof value === 'object' ? (value as any) : {};
  const advancedCandidate =
    candidate.advancedOptions && typeof candidate.advancedOptions === 'object'
      ? candidate.advancedOptions
      : {};
  const advancedEntries = Object.entries(advancedCandidate).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string'
  );

  return {
    preset:
      typeof candidate.preset === 'string'
        ? candidate.preset
        : DEFAULT_SETTINGS.preset,
    language:
      typeof candidate.language === 'string'
        ? candidate.language
        : DEFAULT_SETTINGS.language,
    debridEntries: normalizeDebridEntries(candidate.debridEntries),
    extras: stringArray(candidate.extras, DEFAULT_SETTINGS.extras),
    customAddons: stringArray(
      candidate.customAddons,
      DEFAULT_SETTINGS.customAddons
    ),
    options: stringArray(candidate.options, DEFAULT_SETTINGS.options),
    maxSize:
      typeof candidate.maxSize === 'string' ||
      typeof candidate.maxSize === 'number'
        ? candidate.maxSize
        : DEFAULT_SETTINGS.maxSize,
    advancedOptions: {
      ...DEFAULT_SETTINGS.advancedOptions,
      ...Object.fromEntries(advancedEntries)
    }
  };
}

export function createBuilderSettingsBackup({
  settings,
  exportedAt = new Date(),
  appVersion = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'
}: {
  settings: BuilderSettings;
  exportedAt?: Date;
  appVersion?: string;
}): BuilderSettingsBackup {
  return {
    schema: BUILDER_SETTINGS_BACKUP_SCHEMA,
    schemaVersion: BUILDER_SETTINGS_BACKUP_SCHEMA_VERSION,
    exportedAt: exportedAt.toISOString(),
    app: {
      name: 'stremio-account-bootstrapper',
      version: appVersion
    },
    containsSecrets: true,
    warnings: [SECRET_WARNING],
    payload: normalizeBuilderSettings(settings)
  };
}

export function parseBuilderSettingsBackup(parsed: unknown): BuilderSettings {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid builder settings file');
  }

  const candidate = parsed as any;

  if (candidate.schema === BUILDER_SETTINGS_BACKUP_SCHEMA) {
    return normalizeBuilderSettings(candidate.payload);
  }

  if (candidate.builderSettings) {
    return normalizeBuilderSettings(candidate.builderSettings);
  }

  if (candidate.payload?.builderSettings) {
    return normalizeBuilderSettings(candidate.payload.builderSettings);
  }

  throw new Error('Invalid builder settings file');
}

export function isBuilderSettingsBackup(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== 'object') {
    return false;
  }

  const candidate = parsed as any;
  return (
    candidate.schema === BUILDER_SETTINGS_BACKUP_SCHEMA ||
    Boolean(candidate.builderSettings) ||
    Boolean(candidate.payload?.builderSettings)
  );
}

export function buildBuilderSettingsFilename({
  prefix = 'builder-settings',
  exportedAt = new Date()
}: {
  prefix?: string;
  exportedAt?: Date;
} = {}): string {
  const timestamp = exportedAt.toISOString().replace(/[:.]/g, '-');
  return `${prefix}-${timestamp}.private.json`;
}
