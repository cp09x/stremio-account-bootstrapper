import _ from 'lodash';
import type { AddonConfigContext, SquirrellyRenderer } from './types';
import { debridServicesInfo } from '../../utils/debrid';
import { applyTorrentioPreferences } from '../../utils/streamPreferences';

export function configureTorrentio(
  presetConfig: any,
  context: AddonConfigContext,
  Sqrl: SquirrellyRenderer,
  variantName: string = 'torrentio'
): { rebuilt?: any; shouldReplace: boolean } {
  if (!presetConfig[variantName]) return { shouldReplace: false };

  const { debridEntries, no4k, cached, limit, size, minQuality, excludeAnime } =
    context;

  if (debridEntries.length === 0) {
    presetConfig[variantName].transportUrl = applyTorrentioPreferences(
      Sqrl.render(presetConfig[variantName].transportUrl, {
        transportUrl: '',
        no4k: no4k ? '4k,' : '',
        limit,
        maxSize: size ? `|sizefilter=${size}GB` : ''
      }),
      { minQuality, excludeAnime }
    );
    return { shouldReplace: false };
  }

  const shouldClone = debridEntries.length >= 2;
  const baseTorrentio = shouldClone
    ? _.cloneDeep(presetConfig[variantName])
    : presetConfig[variantName];
  const rebuilt: any = {};

  for (const debrid of debridEntries) {
    const addon = shouldClone ? _.cloneDeep(baseTorrentio) : baseTorrentio;
    const name = shouldClone ? `${variantName}_${debrid.service}` : variantName;
    const servicePair = `${debrid.service}=${debrid.key}`;

    addon.transportUrl = applyTorrentioPreferences(
      Sqrl.render(baseTorrentio.transportUrl, {
        transportUrl: `|sort=qualitysize|debridoptions=${cached ? 'nodownloadlinks,' : ''}nocatalog|${servicePair}`,
        no4k: no4k ? '4k,' : '',
        limit,
        maxSize: size ? `|sizefilter=${size}GB` : ''
      }),
      { minQuality, excludeAnime }
    );

    addon.manifest = addon.manifest || {};
    addon.manifest.name =
      (addon.manifest.name || '') +
      ` | ${debridServicesInfo[debrid.service]?.name || debrid.service}`;

    if (shouldClone) {
      rebuilt[name] = addon;
    }
  }

  return shouldClone
    ? { rebuilt, shouldReplace: true }
    : { shouldReplace: false };
}
