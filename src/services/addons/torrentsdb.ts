import { updateTransportUrl } from '../../utils/transportUrl';
import { convertToMegabytes } from '../../utils/sizeConverters';
import type { AddonConfigContext } from './types';
import {
  appendUniqueFilters,
  getTorrentioQualityFilters
} from '../../utils/streamPreferences';

const ANIME_PROVIDERS = new Set(['nyaa', 'animetosho', 'tokyotosho']);
const STRICT_MIN_720_PROVIDERS = new Set([
  'yts',
  'eztv',
  'torrentgalaxy',
  'limetorrent'
]);
const TORRENTSDB_DEBRID_OPTIONS = ['nocatalog'];
const NO_4K_QUALITY_FILTERS = [
  '4k',
  'brremux',
  'hdrall',
  'dolbyvisionwithhdr',
  'dolbyvision'
];

function getDebridOptions(cached: boolean, existingOptions: unknown): string[] {
  const normalizedOptions = Array.isArray(existingOptions)
    ? existingOptions.filter(
        (option): option is string => typeof option === 'string'
      )
    : [];
  const requiredOptions = cached
    ? ['nodownloadlinks', ...TORRENTSDB_DEBRID_OPTIONS]
    : TORRENTSDB_DEBRID_OPTIONS;

  return Array.from(new Set([...normalizedOptions, ...requiredOptions]));
}

function normalizeQualityFilters(existingFilters: unknown): string[] {
  if (Array.isArray(existingFilters)) {
    return existingFilters.filter(
      (filter): filter is string => typeof filter === 'string'
    );
  }

  if (typeof existingFilters === 'string') {
    return existingFilters.split(',');
  }

  return [];
}

function getProviders(
  providers: unknown,
  {
    minQuality,
    excludeAnime
  }: Pick<AddonConfigContext, 'minQuality' | 'excludeAnime'>
): string[] | undefined {
  if (!Array.isArray(providers)) return undefined;

  let nextProviders = providers.filter(
    (provider): provider is string => typeof provider === 'string'
  );

  if (minQuality === '720p') {
    nextProviders = nextProviders.filter((provider) =>
      STRICT_MIN_720_PROVIDERS.has(provider.trim().toLowerCase())
    );
  }

  if (excludeAnime) {
    nextProviders = nextProviders.filter(
      (provider: string) => !ANIME_PROVIDERS.has(provider.trim().toLowerCase())
    );
  }

  return nextProviders;
}

export function configureTorrentsDB(
  presetConfig: any,
  context: AddonConfigContext
): void {
  if (!presetConfig.torrentsdb) return;

  const {
    debridEntries,
    debridServiceName,
    cached,
    size,
    no4k,
    minQuality,
    excludeAnime
  } = context;

  const updateData: any = {
    sizefilter: size ? convertToMegabytes(size) : ''
  };
  const qualityFiltersToAdd = [
    ...(no4k ? NO_4K_QUALITY_FILTERS : []),
    ...getTorrentioQualityFilters(minQuality)
  ];

  if (debridEntries.length > 0) {
    updateData.sort = 'qualitysize';
    debridEntries.forEach((debrid) => {
      updateData[debrid.service] = debrid.key;
    });
  }

  updateTransportUrl({
    presetConfig,
    serviceKey: 'torrentsdb',
    manifestNameSuffix: debridServiceName,
    updateData: (data: any) => {
      const providers = getProviders(data.providers, {
        minQuality,
        excludeAnime
      });

      return {
        ...data,
        ...updateData,
        qualityfilter: appendUniqueFilters(
          normalizeQualityFilters(data.qualityfilter),
          qualityFiltersToAdd
        ),
        ...(debridEntries.length > 0
          ? { debridoptions: getDebridOptions(cached, data.debridoptions) }
          : {}),
        ...(providers ? { providers } : {})
      };
    }
  });
}
