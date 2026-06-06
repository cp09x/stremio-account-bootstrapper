export type MinQuality = 'any' | '720p';

const BELOW_720_RESOLUTIONS = [
  '576p',
  '480p',
  '360p',
  '240p',
  '144p',
  'unknown',
  'Unknown'
];

const AIOSTREAMS_BELOW_720_RESOLUTIONS = [
  '576p',
  '480p',
  '360p',
  '240p',
  '144p',
  'Unknown'
];

const TORRENTIO_BELOW_720_FILTERS = ['480p', '360p', '240p', '144p'];

const ANIME_PROVIDERS = new Set([
  'anidex',
  'animetosho',
  'horriblesubs',
  'nyaa',
  'nyaasi',
  'tokyotosho'
]);

const ANIME_PATTERN = /\b(anime|hentai|kitsu|myanimelist|mal)\b/i;

export function getExcludedResolutions(minQuality: MinQuality): string[] {
  return minQuality === '720p' ? [...AIOSTREAMS_BELOW_720_RESOLUTIONS] : [];
}

export function getTorrentioQualityFilters(minQuality: MinQuality): string[] {
  return minQuality === '720p' ? [...TORRENTIO_BELOW_720_FILTERS] : [];
}

export function getCometResolutionOverrides(
  minQuality: MinQuality
): Record<string, boolean> {
  if (minQuality !== '720p') return {};

  return {
    r480p: false,
    r360p: false,
    r240p: false,
    unknown: false
  };
}

export function filterResolutionsByMinQuality<T extends string>(
  resolutions: T[] = [],
  minQuality: MinQuality
): T[] {
  if (minQuality !== '720p') return resolutions;

  const excluded = new Set(
    BELOW_720_RESOLUTIONS.map((res) => res.toLowerCase())
  );
  return resolutions.filter((res) => !excluded.has(String(res).toLowerCase()));
}

export function appendUniqueFilters(
  existingFilters: string[] = [],
  filtersToAdd: string[] = []
): string[] {
  const seen = new Set<string>();
  const filters = [];

  for (const filter of [...existingFilters, ...filtersToAdd]) {
    const normalized = String(filter).trim();
    if (!normalized || seen.has(normalized.toLowerCase())) continue;
    seen.add(normalized.toLowerCase());
    filters.push(normalized);
  }

  return filters;
}

export function applyTorrentioPreferences(
  transportUrl: string,
  {
    minQuality,
    excludeAnime
  }: {
    minQuality: MinQuality;
    excludeAnime: boolean;
  }
): string {
  let updatedUrl = transportUrl;

  updatedUrl = updatedUrl.replace(/qualityfilter=([^|/]+)/, (_, filters) => {
    const mergedFilters = appendUniqueFilters(
      String(filters).split(','),
      getTorrentioQualityFilters(minQuality)
    );
    return `qualityfilter=${mergedFilters.join(',')}`;
  });

  if (excludeAnime) {
    updatedUrl = updatedUrl.replace(/providers=([^|/]+)/, (_, providers) => {
      const filteredProviders = String(providers)
        .split(',')
        .filter(
          (provider) => !ANIME_PROVIDERS.has(provider.trim().toLowerCase())
        );
      return `providers=${filteredProviders.join(',')}`;
    });
  }

  return updatedUrl;
}

export function applyManifestContentPreferences(
  manifest: any,
  {
    excludeAnime
  }: {
    excludeAnime: boolean;
  }
): void {
  if (!manifest || !excludeAnime) return;

  if (Array.isArray(manifest.types)) {
    manifest.types = manifest.types.filter(
      (type: string) => !ANIME_PATTERN.test(type)
    );
  }

  if (Array.isArray(manifest.catalogs)) {
    manifest.catalogs = manifest.catalogs.filter((catalog: any) => {
      const searchable = [
        catalog?.id,
        catalog?.name,
        catalog?.type,
        catalog?.source
      ]
        .filter(Boolean)
        .join(' ');
      return !ANIME_PATTERN.test(searchable);
    });
  }

  if (Array.isArray(manifest.addonCatalogs)) {
    manifest.addonCatalogs = manifest.addonCatalogs.filter((catalog: any) => {
      const searchable = [catalog?.id, catalog?.name, catalog?.type]
        .filter(Boolean)
        .join(' ');
      return !ANIME_PATTERN.test(searchable);
    });
  }

  if (Array.isArray(manifest.resources)) {
    manifest.resources = manifest.resources
      .map((resource: any) => {
        if (!resource || typeof resource !== 'object') return resource;

        const nextResource = { ...resource };
        if (Array.isArray(nextResource.types)) {
          nextResource.types = nextResource.types.filter(
            (type: string) => !ANIME_PATTERN.test(type)
          );
        }
        if (Array.isArray(nextResource.idPrefixes)) {
          nextResource.idPrefixes = nextResource.idPrefixes.filter(
            (prefix: string) => !ANIME_PATTERN.test(prefix)
          );
        }
        return nextResource;
      })
      .filter((resource: any) => {
        if (!resource || typeof resource !== 'object') return true;
        return !Array.isArray(resource.types) || resource.types.length > 0;
      });
  }
}

export function applyStreamOnlyManifest(manifest: any): void {
  if (!manifest) return;

  if (Array.isArray(manifest.resources)) {
    manifest.resources = manifest.resources.filter((resource: any) => {
      if (typeof resource === 'string') {
        return resource === 'stream';
      }

      return resource?.name === 'stream';
    });
  }

  if (Array.isArray(manifest.catalogs)) {
    manifest.catalogs = [];
  }

  if (Array.isArray(manifest.addonCatalogs)) {
    manifest.addonCatalogs = [];
  }
}
