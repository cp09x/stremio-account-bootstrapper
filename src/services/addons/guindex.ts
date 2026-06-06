import _ from 'lodash';
import { debridServicesInfo } from '../../utils/debrid';
import type { AddonConfigContext } from './types';

const GUINDEX_SERVICE_PATHS: Record<string, string> = {
  realdebrid: 'realdebrid',
  torbox: 'torbox'
};

const buildGuIndexUrl = (service: string, key: string): string =>
  `https://guindex-stremio.vercel.app/${service}/${encodeURIComponent(key)}/manifest.json`;

export function configureGuIndex(
  presetConfig: any,
  context: AddonConfigContext
): { rebuilt?: any; shouldReplace: boolean } {
  if (!presetConfig.guindex) return { shouldReplace: false };

  const hasStrictStreamConstraints =
    context.cached ||
    context.no4k ||
    context.minQuality === '720p' ||
    Boolean(context.size);

  if (hasStrictStreamConstraints) {
    delete presetConfig.guindex;
    return { shouldReplace: false };
  }

  const supportedDebridEntries = context.debridEntries
    .map((debrid) => ({
      debrid,
      servicePath: GUINDEX_SERVICE_PATHS[debrid.service]
    }))
    .filter((entry): entry is typeof entry & { servicePath: string } =>
      Boolean(entry.servicePath)
    );

  if (supportedDebridEntries.length === 0) {
    delete presetConfig.guindex;
    return { shouldReplace: false };
  }

  const shouldClone = supportedDebridEntries.length >= 2;
  const baseGuIndex = shouldClone
    ? _.cloneDeep(presetConfig.guindex)
    : presetConfig.guindex;
  const rebuilt: Record<string, any> = {};

  for (const { debrid, servicePath } of supportedDebridEntries) {
    const addon = shouldClone ? _.cloneDeep(baseGuIndex) : baseGuIndex;
    const name = shouldClone ? `guindex_${debrid.service}` : 'guindex';
    const serviceName =
      debridServicesInfo[debrid.service]?.name || debrid.service;

    addon.transportUrl = buildGuIndexUrl(servicePath, debrid.key);
    addon.manifest = addon.manifest || {};
    const baseName =
      typeof addon.manifest.name === 'string' &&
      addon.manifest.name.toLowerCase().includes('guindex')
        ? 'GuIndex BR'
        : addon.manifest.name || 'GuIndex BR';
    addon.manifest.name = `${baseName} | ${serviceName}`;

    if (shouldClone) {
      rebuilt[name] = addon;
    }
  }

  return shouldClone
    ? { rebuilt, shouldReplace: true }
    : { shouldReplace: false };
}
