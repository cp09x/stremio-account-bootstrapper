import { updateTransportUrl } from '../../utils/transportUrl';
import { convertToBytes } from '../../utils/sizeConverters';
import type { AddonConfigContext } from './types';
import { getCometResolutionOverrides } from '../../utils/streamPreferences';

export const COMET_COMPACT_RESULT_FORMAT = [
  'video_info',
  'audio_info',
  'quality_info',
  'release_group',
  'size',
  'languages'
];

export function configureComet(
  presetConfig: any,
  context: AddonConfigContext,
  variantName: string = 'comet'
): void {
  if (!presetConfig[variantName]) return;

  const {
    debridEntries,
    cached,
    limit,
    size,
    no4k,
    debridServiceName,
    minQuality
  } = context;

  const debridServices = debridEntries.map((debrid) => ({
    service: debrid.service,
    apiKey: debrid.key
  }));

  updateTransportUrl({
    presetConfig,
    serviceKey: variantName,
    manifestNameSuffix: debridServiceName,
    updateData: (data: any) => ({
      ...data,
      debridServices,
      cachedOnly: cached,
      enableTorrent: debridServices.length === 0,
      maxResultsPerResolution: Math.min(limit, 5),
      maxSize: size ? convertToBytes(size) : 0,
      resultFormat: COMET_COMPACT_RESULT_FORMAT,
      resolutions: {
        ...data.resolutions,
        ...getCometResolutionOverrides(minQuality),
        r2160p: no4k ? false : true
      }
    })
  });
}
