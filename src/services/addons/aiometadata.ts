import { getAddonConfig as getAioMetadataConfig } from '../../api/aioMetadataApi';
import { LOCALE_MESSAGES } from '../../locales';
import type { AdvancedOptions } from './types';

const RATING_FIRST_STREAMING_SORT = 'vote_average';
const TOP_RATED_CATALOG_IDS = new Set([
  'tmdb.discover.movie.top_rated.mlz4ps5f',
  'tmdb.discover.series.top_rated.mlz4rjj0'
]);

function generateCatalogI18nKey(catalog: any): string {
  const source = catalog.source;
  const type = catalog.type;
  const nameSlug = catalog.name
    .toLowerCase()
    .replace(/\s*&\s*/g, '_and_')
    .replace(/\+/g, '_plus')
    .replace(/\s+/g, '_')
    .replace(/[^\w_]/g, '');

  return `catalogs_${source}_${type}_${nameSlug}`;
}

function translateCatalogName(catalogs: any[], language: string): any[] {
  const lang = (language ? String(language) : 'en').split('-')[0] as string;
  const messages = LOCALE_MESSAGES[lang] || LOCALE_MESSAGES.en;

  if (lang === 'en') {
    return catalogs;
  }

  catalogs.forEach((catalog) => {
    const i18nKey = generateCatalogI18nKey(catalog);
    const translatedTitle = messages?.[i18nKey];

    if (translatedTitle && translatedTitle !== i18nKey) {
      catalog.name = translatedTitle;
    }
  });

  return catalogs;
}

export function applyCatalogRatingPreferences(catalogs: any[]): any[] {
  return catalogs.map((catalog) => {
    if (TOP_RATED_CATALOG_IDS.has(catalog.id)) {
      return {
        ...catalog,
        enabled: true,
        showInHome: true,
        randomizePerPage: false
      };
    }

    if (catalog.source === 'streaming' && catalog.sort === 'release_date') {
      return {
        ...catalog,
        sort: RATING_FIRST_STREAMING_SORT,
        sortDirection: 'desc'
      };
    }

    return catalog;
  });
}

export async function configureAioMetadata(
  presetConfig: any,
  data: any,
  language: string,
  kids: boolean,
  excludeAnime: boolean,
  password: string,
  advanced?: AdvancedOptions,
  platform?: string
): Promise<void> {
  if (!presetConfig.aiometadata) return;

  const aioMetadataConfig = data.aioMetadataConfig;

  // Set language
  aioMetadataConfig.config.language = language;

  // Set kids mode
  if (kids) {
    aioMetadataConfig.config.catalogs = aioMetadataConfig.catalogs.kids;
    aioMetadataConfig.config.ageRating = 'G';
    aioMetadataConfig.config.search.engineEnabled = {
      ...aioMetadataConfig.config.search.engineEnabled,
      'kitsu.search.series': false,
      'kitsu.search.movie': false
    };
  } else {
    aioMetadataConfig.config.catalogs = aioMetadataConfig.catalogs.standard;
  }

  if (!kids && aioMetadataConfig.config.catalogs) {
    aioMetadataConfig.config.catalogs = applyCatalogRatingPreferences(
      aioMetadataConfig.config.catalogs
    );
  }

  if (excludeAnime || kids) {
    aioMetadataConfig.config.search = {
      ...aioMetadataConfig.config.search,
      searchOrder: (aioMetadataConfig.config.search.searchOrder || []).filter(
        (entry: string) => !['anime_series', 'anime_movie'].includes(entry)
      ),
      engineEnabled: {
        ...aioMetadataConfig.config.search.engineEnabled,
        'kitsu.search.series': false,
        'kitsu.search.movie': false,
        'mal.search.series': false,
        'mal.search.movie': false
      }
    };
  }

  // Translate catalog names
  if (aioMetadataConfig.config.catalogs) {
    aioMetadataConfig.config.catalogs = translateCatalogName(
      aioMetadataConfig.config.catalogs,
      language
    );
  }

  // Set RPDB key if provided
  if (advanced?.rpdbKey) {
    aioMetadataConfig.config.apiKeys.rpdb = advanced.rpdbKey;
  }

  // Set TMDB key if provided
  if (advanced?.tmdbKey) {
    aioMetadataConfig.config.apiKeys.tmdb = advanced.tmdbKey;
  }

  if (advanced?.tvdbKey) {
    aioMetadataConfig.config.apiKeys.tvdb = advanced.tvdbKey;
  }

  if (advanced?.fanartKey) {
    aioMetadataConfig.config.apiKeys.fanart = advanced.fanartKey;
  }

  if (advanced?.geminiKey) {
    aioMetadataConfig.config.apiKeys.gemini = advanced.geminiKey;
  }

  if (advanced?.topPosterKey) {
    aioMetadataConfig.config.apiKeys.topPoster = advanced.topPosterKey;
  }

  if (advanced?.mdblistKey) {
    aioMetadataConfig.config.apiKeys.mdblist = advanced.mdblistKey;
  }

  if (advanced?.publicMetaDbKey) {
    aioMetadataConfig.config.apiKeys.publicMetaDb = advanced.publicMetaDbKey;
  }

  // Nuvio config
  if (platform === 'nuvio' && !kids) {
    const ENABLED_HOME_CATALOG_IDS = new Set([
      'tmdb.trending',
      'tmdb.discover.movie.latest_movies.mltmmzhu',
      'tmdb.discover.tv.latest_shows.mltmnwjd',
      'tmdb.discover.movie.top_rated.mlz4ps5f',
      'tmdb.discover.series.top_rated.mlz4rjj0'
    ]);

    if (aioMetadataConfig.config.catalogs) {
      aioMetadataConfig.config.catalogs = aioMetadataConfig.config.catalogs.map(
        (catalog: any) => ({
          ...catalog,
          showInHome: ENABLED_HOME_CATALOG_IDS.has(catalog.id),
          enabled: true
        })
      );
    }
  }

  // Request AIOMetadata configuration
  try {
    const aiometadataData = await getAioMetadataConfig({
      config: aioMetadataConfig.config,
      password: password
    });
    if (
      aiometadataData &&
      aiometadataData.manifest &&
      aiometadataData.transportUrl
    ) {
      presetConfig.aiometadata.manifest = aiometadataData.manifest;
      presetConfig.aiometadata.manifest.name = 'AIOMetadata';
      presetConfig.aiometadata.transportUrl = aiometadataData.transportUrl;
    } else {
      delete presetConfig.aiometadata;
      throw new Error(
        'Failed to get AIOMetadata configuration - invalid response'
      );
    }
  } catch (e) {
    delete presetConfig.aiometadata;
    throw new Error(
      `Failed to configure AIOMetadata: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}
