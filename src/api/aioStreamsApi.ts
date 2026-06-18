import { getRequest, postRequest, PROXY_BASE_URL } from '../utils/http';

const RETRY_DELAYS_MS = [500, 1500];

// Transient gateway/network failures intermittently fail addon config calls
// through the CORS proxy (we hit a real 502 that succeeded on manual retry).
// Retry only those; fail fast on 4xx / validation errors where a retry is futile.
const isTransientError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  // 4xx and known validation messages are never retried.
  if (/\b4\d\d\b/.test(message) || lower.includes('invalid_config')) {
    return false;
  }

  return (
    /\b5\d\d\b/.test(message) ||
    lower.includes('timeout') ||
    lower.includes('gateway') ||
    lower.includes('network') ||
    lower.includes('fetch failed') ||
    lower.includes('failed to fetch')
  );
};

export const withTransientRetry = async <T>(
  operation: () => Promise<T>,
  delays: number[] = RETRY_DELAYS_MS
): Promise<T> => {
  let attempt = 0;

  for (;;) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= delays.length || !isTransientError(error)) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
      attempt += 1;
    }
  }
};

const API_BASE_URL = 'https://aiostreamsfortheweebs.midnightignite.me';
const TEMPLATE_URL =
  'https://raw.githubusercontent.com/Tam-Taro/SEL-Filtering-and-Sorting/f8f60711549de651221493abcc72b22dc4e36309/AIOStreams%20Templates/Tamtaro-complete-setup-template.json'; // v2.6.1
const TEMPLATE_TIMEOUT_MS = 20000;
const CONFIG_TIMEOUT_MS = 30000;
const MANIFEST_TIMEOUT_MS = 20000;

type AIOStreamsResponse = {
  success: boolean;
  data?: {
    encryptedPassword: string;
    uuid: string;
  };
};

export const getAddonConfig = async (config: object): Promise<any> => {
  const response = (await withTransientRetry(() =>
    postRequest(
      `${PROXY_BASE_URL}${API_BASE_URL}/api/v1/user`,
      config,
      {},
      CONFIG_TIMEOUT_MS
    )
  )) as AIOStreamsResponse | null | undefined;

  if (
    !response ||
    typeof response !== 'object' ||
    typeof response.success !== 'boolean'
  ) {
    throw new Error('Invalid response from AIOStreams API');
  }

  if (!response.success || !response.data) {
    throw new Error(
      'AIOStreams returned an error or missing credentials payload'
    );
  }

  const manifestUrl = `${API_BASE_URL}/stremio/${response.data.uuid}/${response.data.encryptedPassword}/manifest.json`;

  const responseManifest = await withTransientRetry(() =>
    getRequest(manifestUrl, {}, MANIFEST_TIMEOUT_MS)
  );

  if (!responseManifest) {
    throw new Error('AIOStreams manifest request returned no data');
  }

  return {
    transportUrl: manifestUrl,
    manifest: responseManifest
  };
};

export const getTemplate = async (): Promise<any> => {
  const template = await getRequest(TEMPLATE_URL, {}, TEMPLATE_TIMEOUT_MS);

  if (!template) {
    throw new Error('Error fetching AIOStreams template');
  }

  return template;
};
