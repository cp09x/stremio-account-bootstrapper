import { PROXY_BASE_URL } from '../utils/http';

export type HealthStatus = 'valid' | 'invalid' | 'error';

export interface HealthResult {
  status: HealthStatus;
  // Short human-readable summary, e.g. "Premium · expires 13 Jul 2026".
  message: string;
  // ISO date string when the plan/subscription lapses (debrid services only).
  expiresAt?: string;
  daysLeft?: number;
}

export interface ServiceHealthDef {
  id: string;
  label: string;
  // True for debrid services that also report a plan + expiry date.
  reportsExpiry?: boolean;
  validate: (key: string, signal?: AbortSignal) => Promise<HealthResult>;
}

const TIMEOUT_MS = 15000;

// All checks run from the browser, so they go through the app's generic
// CORS-anywhere worker. It forwards method, headers (incl. Authorization), and
// body to the raw target appended after `?` — verified against every service
// below, including Bearer auth and POST bodies.
const proxied = (target: string): string => `${PROXY_BASE_URL}${target}`;

const fetchProxied = async (
  target: string,
  opts: RequestInit = {},
  signal?: AbortSignal
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  if (signal) {
    if (signal.aborted) controller.abort();
    else
      signal.addEventListener('abort', () => controller.abort(), {
        once: true
      });
  }
  try {
    return await fetch(proxied(target), { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

const safeJson = async (res: Response): Promise<any> => {
  try {
    return await res.json();
  } catch {
    return null;
  }
};

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const daysUntil = (iso: string): number | undefined => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
};

const expirySummary = (
  prefix: string,
  iso: string | undefined
): HealthResult => {
  if (!iso) return { status: 'valid', message: prefix };
  const daysLeft = daysUntil(iso);
  const tail =
    daysLeft !== undefined && daysLeft <= 14 ? ` · ${daysLeft}d left` : '';
  return {
    status: 'valid',
    message: `${prefix} · expires ${formatDate(iso)}${tail}`,
    expiresAt: iso,
    daysLeft
  };
};

const invalid = (message = 'Key rejected by the service'): HealthResult => ({
  status: 'invalid',
  message
});

const networkError = (e: unknown): HealthResult => ({
  status: 'error',
  message: e instanceof Error ? e.message : 'Could not reach the service'
});

const TORBOX_PLANS: Record<number, string> = {
  0: 'Free',
  1: 'Essential',
  2: 'Pro',
  3: 'Standard'
};

export const KEY_VALIDATORS: Record<string, ServiceHealthDef> = {
  torbox: {
    id: 'torbox',
    label: 'TorBox',
    reportsExpiry: true,
    validate: async (key, signal) => {
      try {
        const res = await fetchProxied(
          'https://api.torbox.app/v1/api/user/me?settings=false',
          { headers: { Authorization: `Bearer ${key}` } },
          signal
        );
        const j = await safeJson(res);
        if (!res.ok || !j?.success || !j?.data) return invalid();
        const plan = TORBOX_PLANS[j.data.plan as number] ?? 'Active';
        return expirySummary(plan, j.data.premium_expires_at);
      } catch (e) {
        return networkError(e);
      }
    }
  },
  realdebrid: {
    id: 'realdebrid',
    label: 'RealDebrid',
    reportsExpiry: true,
    validate: async (key, signal) => {
      try {
        const res = await fetchProxied(
          'https://api.real-debrid.com/rest/1.0/user',
          { headers: { Authorization: `Bearer ${key}` } },
          signal
        );
        const j = await safeJson(res);
        if (!res.ok || !j?.type) return invalid();
        const label = j.type === 'premium' ? 'Premium' : 'Free';
        return j.type === 'premium'
          ? expirySummary(label, j.expiration)
          : { status: 'valid', message: label };
      } catch (e) {
        return networkError(e);
      }
    }
  },
  tmdbKey: {
    id: 'tmdbKey',
    label: 'TMDB API key',
    validate: async (key, signal) => {
      try {
        const res = await fetchProxied(
          `https://api.themoviedb.org/3/authentication?api_key=${encodeURIComponent(key)}`,
          {},
          signal
        );
        return res.ok ? { status: 'valid', message: 'Valid' } : invalid();
      } catch (e) {
        return networkError(e);
      }
    }
  },
  tmdbAccessToken: {
    id: 'tmdbAccessToken',
    label: 'TMDB access token',
    validate: async (key, signal) => {
      try {
        const res = await fetchProxied(
          'https://api.themoviedb.org/3/authentication',
          { headers: { Authorization: `Bearer ${key}` } },
          signal
        );
        return res.ok ? { status: 'valid', message: 'Valid' } : invalid();
      } catch (e) {
        return networkError(e);
      }
    }
  },
  tvdbKey: {
    id: 'tvdbKey',
    label: 'TVDB API key',
    validate: async (key, signal) => {
      try {
        const res = await fetchProxied(
          'https://api4.thetvdb.com/v4/login',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apikey: key })
          },
          signal
        );
        const j = await safeJson(res);
        return res.ok && j?.status === 'success'
          ? { status: 'valid', message: 'Valid' }
          : invalid();
      } catch (e) {
        return networkError(e);
      }
    }
  },
  rpdbKey: {
    id: 'rpdbKey',
    label: 'RPDB',
    validate: async (key, signal) => {
      try {
        const res = await fetchProxied(
          `https://api.ratingposterdb.com/${encodeURIComponent(key)}/isValid`,
          {},
          signal
        );
        const j = await safeJson(res);
        return j?.valid === true
          ? { status: 'valid', message: 'Valid' }
          : invalid('API key is invalid');
      } catch (e) {
        return networkError(e);
      }
    }
  },
  fanartKey: {
    id: 'fanartKey',
    label: 'Fanart.tv',
    validate: async (key, signal) => {
      try {
        const res = await fetchProxied(
          `https://webservice.fanart.tv/v3/movies/11?api_key=${encodeURIComponent(key)}`,
          {},
          signal
        );
        return res.ok ? { status: 'valid', message: 'Valid' } : invalid();
      } catch (e) {
        return networkError(e);
      }
    }
  },
  geminiKey: {
    id: 'geminiKey',
    label: 'Google Gemini',
    validate: async (key, signal) => {
      try {
        const res = await fetchProxied(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
          {},
          signal
        );
        return res.ok ? { status: 'valid', message: 'Valid' } : invalid();
      } catch (e) {
        return networkError(e);
      }
    }
  },
  mdblistKey: {
    id: 'mdblistKey',
    label: 'MDBList',
    validate: async (key, signal) => {
      try {
        const res = await fetchProxied(
          `https://api.mdblist.com/user?apikey=${encodeURIComponent(key)}`,
          {},
          signal
        );
        const j = await safeJson(res);
        return res.ok && j?.user_id
          ? { status: 'valid', message: 'Valid' }
          : invalid();
      } catch (e) {
        return networkError(e);
      }
    }
  }
};

export const getValidator = (id: string): ServiceHealthDef | undefined =>
  KEY_VALIDATORS[id];

export const validateKey = async (
  id: string,
  key: string,
  signal?: AbortSignal
): Promise<HealthResult> => {
  const def = KEY_VALIDATORS[id];
  if (!def) {
    return { status: 'error', message: 'No validator for this service' };
  }
  if (!key || !key.trim()) {
    return { status: 'error', message: 'No key set' };
  }
  return def.validate(key.trim(), signal);
};
