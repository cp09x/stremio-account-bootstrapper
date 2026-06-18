import { Buffer } from 'buffer';
import {
  type BuilderSettings,
  normalizeBuilderSettings
} from './builderSettingsBackup';
import {
  debridServicesInfo,
  isValidApiKey,
  type DebridService
} from '../utils/debrid';
import { getDataTransportUrl } from '../utils/transportUrl';

type DebridEntry = { service: DebridService; key: string };

export type BuilderSettingsExtraction = {
  debridEntries: DebridEntry[];
  settings: BuilderSettings;
};

const DEBRID_SERVICES = Object.keys(debridServicesInfo) as DebridService[];
const DEBRID_SERVICE_SET = new Set<string>(DEBRID_SERVICES);

function getAddonUrl(addon: any): string {
  return typeof addon?.transportUrl === 'string'
    ? addon.transportUrl
    : typeof addon?.url === 'string'
      ? addon.url
      : '';
}

function addDebridEntry(
  entries: Map<DebridService, DebridEntry>,
  service: unknown,
  key: unknown
): void {
  if (typeof service !== 'string' || typeof key !== 'string') return;

  const normalizedService = service.trim().toLowerCase();
  if (!DEBRID_SERVICE_SET.has(normalizedService)) return;

  const debridService = normalizedService as DebridService;
  const normalizedKey = decodeURIComponent(key).trim();
  if (!isValidApiKey(debridService, normalizedKey)) return;

  if (!entries.has(debridService)) {
    entries.set(debridService, {
      service: debridService,
      key: normalizedKey
    });
  }
}

function scanObjectForDebridEntries(
  value: unknown,
  entries: Map<DebridService, DebridEntry>
): void {
  if (!value || typeof value !== 'object') return;

  if (Array.isArray(value)) {
    value.forEach((item) => scanObjectForDebridEntries(item, entries));
    return;
  }

  const candidate = value as Record<string, unknown>;
  const service = candidate.service;

  if (typeof service === 'string') {
    addDebridEntry(
      entries,
      service,
      candidate.apiKey ?? candidate.key ?? candidate.token
    );
  }

  for (const [key, item] of Object.entries(candidate)) {
    const normalizedKey = key.toLowerCase();
    if (DEBRID_SERVICE_SET.has(normalizedKey)) {
      addDebridEntry(entries, normalizedKey, item);
    }

    scanObjectForDebridEntries(item, entries);
  }
}

function decodeBase64Json(candidate: string): unknown | null {
  const normalized = candidate
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(candidate.length / 4) * 4, '=');

  try {
    return JSON.parse(Buffer.from(normalized, 'base64').toString('utf-8'));
  } catch {
    return null;
  }
}

function scanDelimitedUrlConfig(
  value: string,
  entries: Map<DebridService, DebridEntry>
): void {
  const decoded = decodeURIComponent(value);
  const configPairs = decoded.matchAll(/(?:^|[|/?&])([a-z]+)=([^|/?&#]+)/gi);

  for (const match of configPairs) {
    addDebridEntry(entries, match[1], match[2]);
  }
}

function scanGuIndexUrl(
  value: string,
  entries: Map<DebridService, DebridEntry>
): void {
  const decoded = decodeURIComponent(value);
  const match = decoded.match(
    /guindex-stremio\.vercel\.app\/(realdebrid|torbox)\/([^/]+)\/manifest\.json/i
  );

  if (match) {
    addDebridEntry(entries, match[1], match[2]);
  }
}

function scanBase64TransportUrl(
  value: string,
  entries: Map<DebridService, DebridEntry>
): void {
  try {
    scanObjectForDebridEntries(getDataTransportUrl(value).data, entries);
  } catch {
    // Some addon URLs contain the config as a path segment that the generic
    // transport parser cannot match because standard base64 may include slashes.
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return;
  }

  const segments = parsed.pathname
    .split('/')
    .map((segment) => decodeURIComponent(segment))
    .filter(Boolean);

  for (const segment of segments) {
    const decoded = decodeBase64Json(segment);
    if (decoded) {
      scanObjectForDebridEntries(decoded, entries);
    }
  }
}

function extractFromAddonUrl(
  url: string,
  entries: Map<DebridService, DebridEntry>
): void {
  if (!url) return;

  scanDelimitedUrlConfig(url, entries);
  scanGuIndexUrl(url, entries);
  scanBase64TransportUrl(url, entries);
}

export function extractBuilderSettingsFromAddons(
  addons: any[]
): BuilderSettingsExtraction {
  const entriesByService = new Map<DebridService, DebridEntry>();

  for (const addon of addons) {
    extractFromAddonUrl(getAddonUrl(addon), entriesByService);
  }

  const debridEntries = Array.from(entriesByService.values());
  const settings = normalizeBuilderSettings({
    debridEntries: debridEntries.length
      ? debridEntries
      : [{ service: '', key: '' }],
    options: ['cached', 'min720p', 'excludeAnime']
  });

  return {
    debridEntries,
    settings
  };
}
