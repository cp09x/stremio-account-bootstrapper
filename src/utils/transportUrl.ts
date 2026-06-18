import { Buffer } from 'buffer';

interface TransportUrl {
  domain: string;
  data: object;
  manifest: string;
}

export const decodeDataFromTransportUrl = (data: string): unknown => {
  let decoded: string;
  try {
    decoded = Buffer.from(data, 'base64').toString('utf-8');
  } catch (e) {
    throw new Error(
      `Failed to base64-decode transport URL data: ${e instanceof Error ? e.message : String(e)}`
    );
  }
  try {
    return JSON.parse(decoded);
  } catch (e) {
    throw new Error(
      `Failed to parse transport URL data as JSON: ${e instanceof Error ? e.message : String(e)}`
    );
  }
};

export const encodeDataFromTransportUrl = (data: unknown): string =>
  Buffer.from(JSON.stringify(data)).toString('base64');

export const getDataTransportUrl = (
  url: string,
  base64: boolean = true
): TransportUrl => {
  const parsedUrl = url.match(
    /(https?:\/\/[^\/]+(?:\/[^\/]+)*\/)([^\/=]+={0,2})(\/manifest\.json)$/
  );
  if (!parsedUrl || !parsedUrl[1] || !parsedUrl[2] || !parsedUrl[3]) {
    throw new Error(`Invalid transport URL: ${url}`);
  }
  const encodedData = parsedUrl[2];
  const parseData = (): object => {
    if (base64) {
      return decodeDataFromTransportUrl(encodedData) as object;
    }
    try {
      return JSON.parse(decodeURIComponent(encodedData));
    } catch (e) {
      throw new Error(
        `Failed to parse transport URL data: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  };
  return {
    domain: parsedUrl[1],
    data: parseData(),
    manifest: parsedUrl[3]
  };
};

export const getUrlTransportUrl = (
  url: TransportUrl,
  data: unknown,
  base64: boolean = true
): string =>
  url.domain +
  (base64
    ? encodeDataFromTransportUrl(data)
    : encodeURIComponent(JSON.stringify(data))) +
  url.manifest;

interface UpdateTransportUrlParams {
  presetConfig: any;
  serviceKey: string;
  manifestNameSuffix?: string;
  updateData: (data: any) => any;
  base64?: boolean;
}

export const updateTransportUrl = ({
  presetConfig,
  serviceKey,
  manifestNameSuffix,
  updateData,
  base64 = true
}: UpdateTransportUrlParams) => {
  const service = presetConfig[serviceKey];
  if (service && service.transportUrl) {
    const transportUrl = getDataTransportUrl(service.transportUrl, base64);
    if (manifestNameSuffix && service.manifest && service.manifest.name) {
      service.manifest.name += ` | ${manifestNameSuffix}`;
    }
    service.transportUrl = getUrlTransportUrl(
      transportUrl,
      updateData(transportUrl.data),
      base64
    );
  }
};
