import { updateTransportUrl } from '../../utils/transportUrl';
import { convertToMegabytes } from '../../utils/sizeConverters';
import type { AddonConfigContext } from './types';
import {
  appendUniqueFilters,
  getTorrentioQualityFilters
} from '../../utils/streamPreferences';

const ANIME_PROVIDERS = new Set(['nyaa', 'animetosho', 'tokyotosho']);
const TORRENTSDB_DEBRID_OPTIONS = ['nocatalog'];

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
    sizefilter: size ? convertToMegabytes(size) : '',
    qualityfilter: [] as string[]
  };

  if (debridEntries.length > 0) {
    updateData.sort = 'qualitysize';
    debridEntries.forEach((debrid) => {
      updateData[debrid.service] = debrid.key;
    });
  }

  if (presetConfig.torrentsdb.transportUrl) {
    const decoded = decodeURIComponent(presetConfig.torrentsdb.transportUrl);
    const qualityMatch = decoded.match(/qualityfilter=([^&|]+)/);
    if (qualityMatch?.[1]) {
      const existingFilters = qualityMatch[1]!.split(',');
      updateData.qualityfilter = appendUniqueFilters(existingFilters, [
        ...(no4k
          ? ['4k', 'brremux', 'hdrall', 'dolbyvisionwithhdr', 'dolbyvision']
          : []),
        ...getTorrentioQualityFilters(minQuality)
      ]);
    }
  }

  updateTransportUrl({
    presetConfig,
    serviceKey: 'torrentsdb',
    manifestNameSuffix: debridServiceName,
    updateData: (data: any) => ({
      ...data,
      ...updateData,
      ...(debridEntries.length > 0
        ? { debridoptions: getDebridOptions(cached, data.debridoptions) }
        : {}),
      ...(excludeAnime && Array.isArray(data.providers)
        ? {
            providers: data.providers.filter(
              (provider: string) =>
                !ANIME_PROVIDERS.has(provider.trim().toLowerCase())
            )
          }
        : {})
    })
  });
}
