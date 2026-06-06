import { debridServicesInfo } from '../../utils/debrid';
import type { MinQuality } from '../../utils/streamPreferences';

export interface DebridEntry {
  service: keyof typeof debridServicesInfo;
  key: string;
}

export interface AddonConfigContext {
  language: string;
  no4k: boolean;
  cached: boolean;
  limit: number;
  size: string | number;
  debridEntries: DebridEntry[];
  debridServiceName: string;
  preset: string;
  password?: string;
  advanced?: AdvancedOptions;
  minQuality: MinQuality;
  excludeAnime: boolean;
}

export interface AdvancedOptions {
  rpdbKey?: string;
  tmdbKey?: string;
  tmdbAccessToken?: string;
  tvdbKey?: string;
  fanartKey?: string;
  geminiKey?: string;
  topPosterKey?: string;
  mdblistKey?: string;
  publicMetaDbKey?: string;
}

export interface SquirrellyRenderer {
  render(template: string, data: object): string;
}
