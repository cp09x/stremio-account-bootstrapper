import {
  getAddonConfig as getAioStreamsConfig,
  getTemplate
} from '../../api/aioStreamsApi';
import type { AddonConfigContext } from './types';
import { getLanguageName } from '../../utils/language';
import { convertToBytes } from '../../utils/sizeConverters';
import _ from 'lodash';
import { applyTemplateConditionals } from '../../utils/templateConditionals';
import {
  applyManifestContentPreferences,
  applyStreamOnlyManifest,
  getExcludedResolutions
} from '../../utils/streamPreferences';

// Asymmetry: cacheAndPlay.streamTypes only accepts 'usenet'|'torrent' (NOT
// 'debrid', unlike preferredStreamTypes) — passing 'debrid' makes AIOStreams
// reject the whole config with a 400.
const CACHE_AND_PLAY_STREAM_TYPES = ['usenet', 'torrent'] as const;

function addLanguageSpecificAddons(
  presets: any[],
  language: string,
  isDebridUser: boolean
): void {
  const cometaConfig = {
    type: 'comet',
    instanceId: 'c25',
    enabled: true,
    options: {
      name: 'Cometa',
      timeout: 5000,
      resources: ['stream'],
      url: 'https://cometa.stremx.net',
      includeP2P: !isDebridUser,
      removeTrash: false,
      scrapeDebridAccountTorrents: false,
      useMultipleInstances: false,
      mediaTypes: []
    },
    category: isDebridUser ? 'Debrid' : 'P2P'
  };

  const languageAddons: Record<string, any[]> = {
    'es-MX': [{ ...cometaConfig }],
    'es-ES': [
      { ...cometaConfig },
      ...(isDebridUser
        ? [
            {
              type: 'peerflix',
              instanceId: 'c7e',
              enabled: true,
              options: {
                name: 'Peerflix',
                timeout: 5000,
                resources: ['stream'],
                mediaTypes: [],
                useMultipleInstances: false,
                showTorrentLinks: false
              },
              category: 'Debrid'
            }
          ]
        : [])
    ],
    'pt-BR': [
      {
        type: 'brazuca-torrents',
        instanceId: '0cc',
        enabled: true,
        options: {
          name: 'Brazuca Torrents',
          timeout: 5000,
          resources: ['stream']
        },
        category: isDebridUser ? 'Debrid' : 'P2P'
      }
    ]
  };

  if (languageAddons[language]) {
    presets.push(...languageAddons[language]);
  }
}

function getWebStreamrConfig(language: string): any {
  const baseProviders = ['multi', 'en'];

  const languageProviders: Record<string, string[]> = {
    'es-MX': ['mx'],
    'es-ES': ['es'],
    it: ['it'],
    fr: ['fr'],
    de: ['de']
  };

  const additionalProviders = languageProviders[language] || [];

  return {
    type: 'webstreamr',
    instanceId: '48e',
    enabled: true,
    options: {
      name: 'WebStreamrMBG',
      timeout: 7000,
      resources: ['stream'],
      url: 'https://87d6a6ef6b58-webstreamrmbg.baby-beamup.club',
      mediaTypes: [],
      providers: [...baseProviders, ...additionalProviders],
      includeExternalUrls: false,
      showErrors: false
    },
    category: 'HTTP'
  };
}

function restrictPresetMediaTypes(presets: any[]): void {
  if (!Array.isArray(presets)) return;

  for (const preset of presets) {
    if (Array.isArray(preset?.options?.mediaTypes)) {
      preset.options.mediaTypes = ['movie', 'series'];
    }
  }
}

// Extract default values
function extractInputDefaults(inputs: any[]): Record<string, any> {
  const defaults: Record<string, any> = {};
  if (!Array.isArray(inputs)) return defaults;
  for (const input of inputs) {
    if (
      !input ||
      typeof input !== 'object' ||
      typeof input.id !== 'string' ||
      !input.id.trim()
    )
      continue;
    if (input.type === 'subsection' && Array.isArray(input.subOptions)) {
      defaults[input.id] = extractInputDefaults(input.subOptions);
    } else if ('default' in input) {
      defaults[input.id] = input.default;
    }
  }
  return defaults;
}

// Call AIOStreams template processing logic to apply conditionals
function processTemplate(
  template: any,
  props: Record<string, any>,
  selectedSvcs: string[]
): any {
  const inputDefaults = extractInputDefaults(template?.metadata?.inputs || []);
  const mergedProps = _.merge({}, inputDefaults, props);
  return applyTemplateConditionals(template, mergedProps, selectedSvcs);
}

export async function configureAioStreams(
  presetConfig: any,
  context: AddonConfigContext
): Promise<void> {
  if (!presetConfig.aiostreams) return;

  const {
    debridEntries,
    debridServiceName,
    language,
    no4k,
    cached,
    size,
    password,
    advanced,
    minQuality,
    excludeAnime
  } = context;
  const isDebridUser = debridEntries.length > 0;
  const hasTorbox = debridEntries.some((debrid) => debrid.service === 'torbox');

  // Fetch template
  let template: any;
  try {
    template = await getTemplate();
  } catch (e) {
    delete presetConfig.aiostreams;
    throw new Error(
      `AIOStreams template fetch failed: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  // Set debrid services
  const debridServices = debridEntries.map((debrid) => ({
    id: debrid.service,
    enabled: true,
    credentials: {
      apiKey: debrid.key
    }
  }));

  // Add parent language when selected language is es-MX or pt-BR
  const primaryLanguage =
    language === 'pt-BR' ? 'Portuguese (Brazil)' : getLanguageName(language);
  const templateLanguages = [
    primaryLanguage,
    ...(language === 'en' ? ['Portuguese (Brazil)', 'Portuguese'] : []),
    ...(language === 'es-MX' ? ['Spanish'] : []),
    ...(language === 'pt-BR' ? ['Portuguese'] : [])
  ];
  const languagePassthrough = {
    language: primaryLanguage,
    languageAmount: 10,
    languagePin: language !== 'en' ? true : false,
    subLanguage: primaryLanguage,
    subLanguageAmount: 10,
    subLanguagePin: false
  };
  const miscPassthrough = {
    overallTopQualRes: 12
  };
  const deviceExclude = [
    ...(no4k ? ['4k'] : []),
    'av1',
    'trueHD',
    'dts',
    'DVonly',
    'dvOnlyNonRemux',
    'DVP7'
  ];

  // Process template
  const processedTemplate = processTemplate(
    template,
    {
      languages: templateLanguages,
      subtitles: templateLanguages,
      includeAddon: {
        subtitleLanguages: ['disabled']
      },
      LanguagePassthrough: languagePassthrough,
      coreFilter: 'extended',
      miscPassthrough,
      torboxTier: 'nonPro',
      deviceExclude,
      // Strong Library Boost pushes TorBox's reliable owned/Library results to
      // the top of sortCriteria (above resolution/quality), matching the
      // template's `inputs.sorting.library == high` branch.
      ...(hasTorbox && { sorting: { library: 'high' } })
    },
    debridServices.map((svc) => svc.id)
  );

  template = processedTemplate;

  // Add language-specific addons
  addLanguageSpecificAddons(template.config.presets, language, isDebridUser);

  // Remove Webstreamr if it exists and add it with language-specific providers
  template.config.presets = template.config.presets.filter(
    (preset: any) => preset.type !== 'webstreamr'
  );
  if (!cached) {
    const webstreamrConfig = getWebStreamrConfig(language);
    template.config.presets.push(webstreamrConfig);
  }

  if (excludeAnime) {
    restrictPresetMediaTypes(template.config.presets);
  }

  // Build config overrides
  const configOverrides = {
    services: debridServices,
    languages: templateLanguages,
    subtitles: templateLanguages,
    LanguagePassthrough: languagePassthrough,
    coreFilter: 'extended',
    miscPassthrough,
    deviceExclude,
    excludedResolutions: getExcludedResolutions(minQuality),
    ...(size && {
      size: {
        global: {
          movies: [0, convertToBytes(size)],
          series: [0, convertToBytes(size)],
          anime: [0, convertToBytes(size)]
        }
      }
    }),
    ...(cached && { excludeUncached: true }),
    // TorBox's instant torrent cache can return the wrong file from multi-file
    // packs (.nfo/sample/screenshot instead of the video), which surfaces in
    // Stremio as "stream failed to load". Prefer TorBox's reliable
    // Usenet/Library copies over the flaky torrent cache, and let cacheAndPlay
    // pull torrents so the correct file is extracted before playback.
    ...(hasTorbox && {
      preferredStreamTypes: ['usenet', 'debrid'],
      cacheAndPlay: {
        enabled: true,
        streamTypes: [...CACHE_AND_PLAY_STREAM_TYPES]
      }
    }),
    formatter: {
      id: 'lightgdrive'
    },
    tmdbAccessToken: advanced?.tmdbAccessToken || '',
    tvdbApiKey: advanced?.tvdbKey || '',
    tmdbApiKey: advanced?.tmdbKey || '',
    ...(!advanced?.tmdbKey && {
      bitrate: { useMetadataRuntime: false }
    })
  };

  template = {
    ...template,
    config: { ...template.config, ...configOverrides },
    password
  };

  // Get addon config
  try {
    const aioStreamsData = await getAioStreamsConfig(template);
    if (aioStreamsData?.manifest && aioStreamsData?.transportUrl) {
      presetConfig.aiostreams.manifest = aioStreamsData.manifest;
      presetConfig.aiostreams.manifest.name =
        'AIOStreams' + (debridServiceName ? ` | ${debridServiceName}` : '');
      applyStreamOnlyManifest(presetConfig.aiostreams.manifest);
      applyManifestContentPreferences(presetConfig.aiostreams.manifest, {
        excludeAnime
      });
      presetConfig.aiostreams.transportUrl = aioStreamsData.transportUrl;
    } else {
      delete presetConfig.aiostreams;
      throw new Error('AIOStreams returned an invalid configuration response');
    }
  } catch (e) {
    delete presetConfig.aiostreams;
    throw new Error(
      `AIOStreams configuration failed: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}
