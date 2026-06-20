<script setup>
import {
  ref,
  computed,
  watch,
  nextTick,
  onMounted,
  onBeforeUnmount
} from 'vue';
import { useI18n } from 'vue-i18n';
import draggable from 'vuedraggable';
import AddonItem from './AddonItem.vue';
import DynamicForm from './DynamicForm.vue';
import ApiHealthPanel from './ApiHealthPanel.vue';
import {
  QuestionMarkCircleIcon,
  CheckCircleIcon,
  Squares2X2Icon,
  KeyIcon,
  AdjustmentsHorizontalIcon,
  ListBulletIcon,
  Cog6ToothIcon,
  PlusIcon,
  MinusIcon
} from '@heroicons/vue/24/outline';
import { addNotification } from '../composables/useNotifications';
import { useAnalytics } from '../composables/useAnalytics';
import { isValidApiKey, debridServicesInfo } from '../utils/debrid.ts';
import { isValidManifestUrl } from '../utils/url.ts';
import {
  getAddonCollection,
  setAddonCollection,
  pullProfiles
} from '../api/platformApi';
import { diffAddonCollections } from '../utils/addonDiff.ts';
import {
  buildPresetService,
  loadPresetService
} from '../services/presetService.ts';
import {
  buildBuilderSettingsFilename,
  createBuilderSettingsBackup,
  parseBuilderSettingsBackup
} from '../services/builderSettingsBackup.ts';
import { generatePassword } from '../utils/password.ts';
import { Tooltip as VTooltip } from 'floating-vue';
import 'floating-vue/dist/style.css';

const { t } = useI18n();

const props = defineProps({
  authKey: { type: String },
  authSource: {
    type: String,
    default: ''
  },
  platform: {
    type: String,
    default: 'stremio'
  },
  restoredAccountSnapshot: {
    type: Object,
    default: null
  },
  importedBuilderSettings: {
    type: Object,
    default: null
  }
});

const platformLabel = computed(() =>
  props.platform === 'nuvio' ? 'Nuvio' : 'Stremio'
);

let dragging = false;
let addons = ref([]);
let customAddons = ref(['']);
let extras = ref([]);
let options = ref(['cached', 'min720p', 'excludeAnime']);
let maxSize = ref('');
let isSyncButtonEnabled = ref(false);
let isLoadingCurrentAccount = ref(false);
let isLoadingPreset = ref(false);
let isSyncAddons = ref(false);
let language = ref('en');
let preset = ref('allinone');

let debridEntries = ref([{ service: '', key: '' }]);
let collections = [];
let nuvioProfiles = ref([]);
let selectedNuvioProfileId = ref(1);
let isLoadingNuvioProfiles = ref(false);

let isPasswordModalVisible = ref(false);
let generatedPassword = ref(generatePassword());
let passwordAcknowledged = ref(false);
let currentAccountSnapshot = ref(null);

let isSyncConfirmVisible = ref(false);
let isPreparingSync = ref(false);
let syncDiff = ref(null);
let lastSyncSnapshot = ref(null);
let isUndoingSync = ref(false);
let isUndoConfirmVisible = ref(false);
let builderSettingsFileInputRef = ref(null);
let lastBuilderSettingsImport = ref(null);
let addonBuildErrors = ref([]);

const MAX_CUSTOM_ADDONS = 10;
const MAX_DEBRID_ENTRIES = 5;

const canAddCustom = computed(
  () => customAddons.value.length < MAX_CUSTOM_ADDONS
);

const canAddDebridEntry = computed(() => {
  if (debridEntries.value.length >= MAX_DEBRID_ENTRIES) return false;
  const last = debridEntries.value[debridEntries.value.length - 1];
  if (!last) return false;
  if (!last.service) return false;
  if (!last.key) return false;
  return isValidApiKey(last.service, last.key);
});

const isDebridApiKeyValid = computed(() => {
  if (!debridEntries.value.some((e) => e.service)) return false;
  return debridEntries.value
    .filter((e) => e.service)
    .every((e) => e.key && isValidApiKey(e.service, e.key));
});

const hasDebridSelected = computed(() =>
  debridEntries.value.some((e) => e.service)
);

const accountSnapshot = computed(() => {
  const snapshot =
    currentAccountSnapshot.value || props.restoredAccountSnapshot;

  if (!snapshot) {
    return null;
  }

  if (snapshot.platform && snapshot.platform !== props.platform) {
    return null;
  }

  return snapshot;
});

let isEditModalVisible = ref(false);
let currentManifest = ref({});
let currentEditIdx = ref(null);

let advancedOptions = ref({
  rpdbKey: '',
  tmdbKey: '',
  tmdbAccessToken: '',
  tvdbKey: '',
  fanartKey: '',
  geminiKey: '',
  topPosterKey: '',
  mdblistKey: '',
  publicMetaDbKey: ''
});

// Presentational-only: drives the preset card grid. Values match the existing
// `preset` v-model radio values, so the underlying logic is unchanged.
const presetOptions = [
  { value: 'minimal', label: 'minimal', details: 'preset_minimal_details' },
  { value: 'standard', label: 'standard', details: 'preset_standard_details' },
  { value: 'full', label: 'full', details: 'preset_full_details' },
  { value: 'allinone', label: 'allinone', details: 'preset_allinone_details' },
  {
    value: 'http_only',
    label: 'http_only',
    details: 'preset_http_only_details'
  },
  {
    value: 'no_streams',
    label: 'no_streams',
    details: 'preset_no_streams_details'
  },
  { value: 'factory', label: 'factory', details: 'preset_factory_details' }
];

const languageOptions = [
  { value: 'en', flag: '🇺🇸', label: 'english' },
  { value: 'es-MX', flag: '🇲🇽', label: 'spanish_latino' },
  { value: 'es-ES', flag: '🇪🇸', label: 'spanish_spain' },
  { value: 'pt-BR', flag: '🇧🇷', label: 'portuguese_brazil' },
  { value: 'pt-PT', flag: '🇵🇹', label: 'portuguese_portugal' },
  { value: 'fr', flag: '🇫🇷', label: 'french' },
  { value: 'it', flag: '🇮🇹', label: 'italian' },
  { value: 'de', flag: '🇩🇪', label: 'german' },
  { value: 'nl', flag: '🇱🇺', label: 'dutch' }
];

// Presentational-only: controls the advanced-keys accordion (collapsed default).
const isAdvancedKeysOpen = ref(false);

// Refs used to focus a specific field when the health panel emits `focus-field`.
// Advanced-key inputs are keyed by their validator id (== advancedOptions prop).
const advancedKeyInputRefs = ref({});
// Debrid <select> elements, keyed by entry index.
const debridServiceRefs = ref({});

function setAdvancedKeyInputRef(id, el) {
  if (el) advancedKeyInputRefs.value[id] = el;
  else delete advancedKeyInputRefs.value[id];
}

function setDebridServiceRef(idx, el) {
  if (el) debridServiceRefs.value[idx] = el;
  else delete debridServiceRefs.value[idx];
}

const ADVANCED_OPTION_IDS = [
  'rpdbKey',
  'tmdbKey',
  'tmdbAccessToken',
  'tvdbKey',
  'fanartKey',
  'geminiKey',
  'topPosterKey',
  'mdblistKey',
  'publicMetaDbKey'
];

// The health panel reports a validator id. For advanced keys the id matches the
// advancedOptions property; for debrid keys the id is the service name, so we
// match the entry whose `service` equals the id.
function focusHealthField(id) {
  if (ADVANCED_OPTION_IDS.includes(id)) {
    isAdvancedKeysOpen.value = true;
  }

  let target = advancedKeyInputRefs.value[id];

  if (!target) {
    const idx = debridEntries.value.findIndex((entry) => entry.service === id);
    if (idx !== -1) target = debridServiceRefs.value[idx];
  }

  if (!target) return;

  nextTick(() => {
    requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.focus();
    });
  });
}

function currentBuilderSettings() {
  return {
    preset: preset.value,
    language: language.value,
    debridEntries: debridEntries.value.map((entry) => ({ ...entry })),
    extras: [...extras.value],
    customAddons: [...customAddons.value],
    options: [...options.value],
    maxSize: maxSize.value,
    advancedOptions: { ...advancedOptions.value },
    password: generatedPassword.value
  };
}

function exportBuilderSettings() {
  const backup = createBuilderSettingsBackup({
    settings: currentBuilderSettings()
  });
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = buildBuilderSettingsFilename();
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  addNotification(t('builder_settings_exported'), 'success');
}

function openBuilderSettingsFilePicker() {
  builderSettingsFileInputRef.value?.click();
}

function applyBuilderSettings(settings, source = {}) {
  preset.value = settings.preset;
  language.value = settings.language;
  debridEntries.value =
    settings.debridEntries.length > 0
      ? settings.debridEntries.map((entry) => ({ ...entry }))
      : [{ service: '', key: '' }];
  extras.value = [...settings.extras];
  customAddons.value =
    settings.customAddons.length > 0 ? [...settings.customAddons] : [''];
  options.value = [...settings.options];
  maxSize.value = settings.maxSize;
  advancedOptions.value = {
    ...advancedOptions.value,
    ...settings.advancedOptions
  };
  if (settings.password) {
    generatedPassword.value = settings.password;
  }
  isSyncButtonEnabled.value = false;
  lastBuilderSettingsImport.value = {
    fileName: source.fileName || 'Builder settings',
    importedAt: source.importedAt || new Date().toISOString(),
    debridServices: debridEntries.value
      .filter((entry) => entry.service)
      .map((entry) => entry.service)
  };
  addNotification(t('builder_settings_imported'), 'success');
}

async function importBuilderSettingsFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const parsed = JSON.parse(await file.text());
    applyBuilderSettings(parseBuilderSettingsBackup(parsed), {
      fileName: file.name
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Failed to import builder settings';
    addNotification(errorMessage, 'error');
  } finally {
    event.target.value = '';
  }
}

async function loadUserAddons() {
  const key = props.authKey;

  if (!key) {
    console.error('No auth key provided');
    return;
  }

  isLoadingPreset.value = true;
  isSyncButtonEnabled.value = false;
  console.log('Loading addons...');

  try {
    const {
      selectedAddons,
      collections: builtCollections = [],
      errors: presetErrors = []
    } = await buildPresetService({
      preset: preset.value,
      language: language.value,
      extras: extras.value,
      customAddons: customAddons.value,
      options: options.value,
      maxSize: maxSize.value,
      advanced: {
        ...advancedOptions.value
      },
      debridEntries: debridEntries.value,
      password: generatedPassword.value,
      platform: props.platform
    });

    addons.value = selectedAddons;
    collections = builtCollections;
    isSyncButtonEnabled.value = selectedAddons.length > 0;
    addonBuildErrors.value = [...presetErrors];

    if (presetErrors.length > 0) {
      addNotification(presetErrors.join('\n'), 'warning');
    }
  } catch (error) {
    console.error('Error fetching preset config', error);
    const errorMessage =
      error instanceof Error ? error.message : t('failed_fetching_presets');
    addNotification(errorMessage, 'error');
    addons.value = [];
    collections = [];
    isSyncButtonEnabled.value = false;
    addonBuildErrors.value = [];
  } finally {
    isLoadingPreset.value = false;
  }
}

async function syncUserAddons() {
  const key = props.authKey;
  if (!key) {
    console.error('No auth key provided');
    return;
  }

  isPreparingSync.value = true;

  try {
    const response = await getAddonCollection(
      props.platform,
      key,
      selectedNuvioProfileId.value ?? 1
    );
    const currentAddons = extractAddonList(response);

    lastSyncSnapshot.value = currentAddons;
    syncDiff.value = diffAddonCollections(currentAddons, addons.value);
    isSyncConfirmVisible.value = true;
    document.body.classList.add('modal-open');
  } catch (error) {
    console.error('Failed to load current account before sync', error);
    const errorMessage =
      error instanceof Error ? error.message : t('sync_diff_load_failed');
    addNotification(errorMessage, 'error');
  } finally {
    isPreparingSync.value = false;
  }
}

function cancelSyncConfirm() {
  isSyncConfirmVisible.value = false;
  syncDiff.value = null;
  document.body.classList.remove('modal-open');
}

async function confirmSyncUserAddons() {
  const { track } = useAnalytics();
  const key = props.authKey;
  if (!key) {
    console.error('No auth key provided');
    return;
  }

  isSyncConfirmVisible.value = false;
  document.body.classList.remove('modal-open');
  isSyncAddons.value = true;
  console.log('Syncing addons...');

  try {
    const data = await loadPresetService({
      addons: addons.value,
      key,
      platform: props.platform,
      collections,
      profileId: selectedNuvioProfileId.value ?? 1
    });
    addNotification(t('sync_complete'), 'success');
    track('sync_stremio_click', {
      title: `Sync to ${platformLabel.value}`,
      vars: {
        platform: props.platform,
        language: language.value,
        preset: preset.value,
        debrid: debridEntries.value
          .filter((entry) => entry.service)
          .map((entry) => entry.service)
          .join(',')
      }
    });
    if (preset.value !== 'factory') {
      passwordAcknowledged.value = false;
      isPasswordModalVisible.value = true;
    }
    console.log('Sync complete: ', data);
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : t('failed_syncing_addons', { platform: platformLabel.value });
    addNotification(errorMessage, 'error');
    console.error('Sync failed', error);
  } finally {
    isSyncAddons.value = false;
    syncDiff.value = null;
  }
}

function requestUndoLastSync() {
  if (!lastSyncSnapshot.value) return;
  isUndoConfirmVisible.value = true;
  document.body.classList.add('modal-open');
}

function cancelUndoConfirm() {
  isUndoConfirmVisible.value = false;
  document.body.classList.remove('modal-open');
}

async function confirmUndoLastSync() {
  const key = props.authKey;
  const snapshot = lastSyncSnapshot.value;
  if (!key || !snapshot) {
    isUndoConfirmVisible.value = false;
    document.body.classList.remove('modal-open');
    return;
  }

  isUndoConfirmVisible.value = false;
  document.body.classList.remove('modal-open');
  isUndoingSync.value = true;

  try {
    const res = await setAddonCollection(
      props.platform,
      snapshot,
      key,
      selectedNuvioProfileId.value ?? 1
    );
    if (res?.result?.success === false) {
      throw new Error(res?.result?.error || t('undo_sync_failed'));
    }
    addNotification(t('undo_sync_complete'), 'success');
    lastSyncSnapshot.value = null;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : t('undo_sync_failed');
    addNotification(errorMessage, 'error');
    console.error('Undo sync failed', error);
  } finally {
    isUndoingSync.value = false;
  }
}

function closePasswordModal() {
  if (!passwordAcknowledged.value) return;
  isPasswordModalVisible.value = false;
  document.body.classList.remove('modal-open');
}

function copyPassword() {
  navigator.clipboard.writeText(generatedPassword.value);
  addNotification(t('password_copied'), 'success');
}

function downloadPassword() {
  const blob = new Blob([generatedPassword.value], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'stremio-addon-password.txt';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function removeAddon(idx) {
  addons.value.splice(idx, 1);
}

function getAddonName(addon) {
  return addon?.manifest?.name || addon?.name || 'Unknown addon';
}

function extractAddonList(response) {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.result?.addons)) {
    return response.result.addons;
  }

  if (Array.isArray(response?.addons)) {
    return response.addons;
  }

  return [];
}

async function loadCurrentAccountAddons() {
  const key = props.authKey;

  if (!key) {
    return;
  }

  isLoadingCurrentAccount.value = true;

  try {
    const response = await getAddonCollection(
      props.platform,
      key,
      selectedNuvioProfileId.value ?? 1
    );
    const currentAddons = extractAddonList(response);

    addons.value = currentAddons;
    collections = [];
    isSyncButtonEnabled.value = currentAddons.length > 0;
    currentAccountSnapshot.value = {
      addonCount: currentAddons.length,
      addonNames: currentAddons.map(getAddonName),
      fileName: 'Current account',
      platform: props.platform,
      sourceFormat: 'account'
    };

    addNotification(
      t('loaded_account_addons', {
        count: currentAddons.length,
        platform: platformLabel.value
      }),
      'success'
    );
  } catch (error) {
    console.error('Failed to load current account addons', error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : t('failed_loading_account_addons', { platform: platformLabel.value });
    addNotification(errorMessage, 'error');
  } finally {
    isLoadingCurrentAccount.value = false;
  }
}

// functions to manage dynamic custom inputs
function addCustomAddon() {
  if (!canAddCustom.value) return;
  customAddons.value.push('');
}

function removeCustomAddon(idx) {
  if (idx === 0) return;
  customAddons.value.splice(idx, 1);
}

function getNestedObjectProperty(obj, path, defaultValue = null) {
  try {
    return path.split('.').reduce((acc, part) => acc?.[part], obj);
  } catch (e) {
    return defaultValue;
  }
}

function openEditModal(idx) {
  isEditModalVisible.value = true;
  currentEditIdx.value = idx;
  currentManifest.value = { ...addons.value[idx].manifest };
  document.body.classList.add('modal-open');
}

function closeEditModal() {
  isEditModalVisible.value = false;
  currentManifest.value = {};
  currentEditIdx.value = null;
  document.body.classList.remove('modal-open');
}

function saveManifestEdit(updatedManifest) {
  try {
    addons.value[currentEditIdx.value].manifest = updatedManifest;
    closeEditModal();
  } catch (e) {
    addNotification(t('failed_update_manifest'), 'error');
  }
}

function addDebridEntry() {
  if (!canAddDebridEntry.value) return;
  if (debridEntries.value.length >= MAX_DEBRID_ENTRIES) return;
  debridEntries.value.push({ service: '', key: '' });
}

function removeDebridEntry(idx) {
  if (debridEntries.value.length === 1) return;
  debridEntries.value.splice(idx, 1);
}

function resetEntryKey(idx) {
  debridEntries.value[idx].key = '';
}

const extractProfiles = (response) => {
  if (!Array.isArray(response)) {
    return [];
  }

  return response
    .map((profile) => {
      const id = Number(profile?.profile_index);

      if (!Number.isFinite(id)) {
        return null;
      }

      return {
        id,
        name: profile?.name || t('profile_fallback_name', { id })
      };
    })
    .filter(Boolean);
};

function resetNuvioProfiles() {
  nuvioProfiles.value = [];
  selectedNuvioProfileId.value = 1;
}

async function loadNuvioProfiles() {
  if (props.platform !== 'nuvio' || !props.authKey) {
    resetNuvioProfiles();
    return;
  }

  isLoadingNuvioProfiles.value = true;

  try {
    const response = await pullProfiles(props.authKey);
    const profiles = extractProfiles(response);
    nuvioProfiles.value = profiles;

    if (profiles.length === 0) {
      selectedNuvioProfileId.value = 1;
      return;
    }

    const hasCurrent = profiles.some(
      (profile) => profile.id === selectedNuvioProfileId.value
    );
    if (!hasCurrent) {
      selectedNuvioProfileId.value = profiles[0].id;
    }
  } catch (error) {
    console.error('Failed to load profiles', error);
    resetNuvioProfiles();
    addNotification(t('profile_load_failed'), 'error');
  } finally {
    isLoadingNuvioProfiles.value = false;
  }
}

watch(
  () => props.platform,
  (nextPlatform, previousPlatform) => {
    if (nextPlatform !== previousPlatform) {
      resetNuvioProfiles();
    }
  }
);

watch(
  () => props.importedBuilderSettings,
  (payload) => {
    if (!payload?.settings) {
      return;
    }

    applyBuilderSettings(payload.settings, {
      fileName: payload.fileName,
      importedAt: payload.importedAt
    });
  }
);

watch(
  () => [props.authKey, props.authSource],
  ([nextAuthKey, nextAuthSource], [previousAuthKey, previousAuthSource]) => {
    if (props.platform !== 'nuvio') {
      resetNuvioProfiles();
      return;
    }

    if (!nextAuthKey) {
      resetNuvioProfiles();
      return;
    }

    const isSuccessfulLogin =
      nextAuthSource === 'login' && previousAuthSource !== 'login';

    if (isSuccessfulLogin && nextAuthKey && nextAuthKey !== previousAuthKey) {
      loadNuvioProfiles();
    }
  }
);

// Refs to each modal's container so we can move focus in on open.
const syncDiffDialogRef = ref(null);
const undoDialogRef = ref(null);
const passwordDialogRef = ref(null);
const editDialogRef = ref(null);

function focusDialog(dialogEl) {
  if (!dialogEl) return;
  nextTick(() => {
    const focusable = dialogEl.querySelector(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    (focusable || dialogEl).focus?.();
  });
}

watch(
  isSyncConfirmVisible,
  (open) => open && focusDialog(syncDiffDialogRef.value)
);
watch(isUndoConfirmVisible, (open) => open && focusDialog(undoDialogRef.value));
watch(
  isPasswordModalVisible,
  (open) => open && focusDialog(passwordDialogRef.value)
);
watch(isEditModalVisible, (open) => open && focusDialog(editDialogRef.value));

function handleGlobalKeydown(event) {
  if (event.key !== 'Escape') return;
  // Close only the top-most open modal; respect each modal's own close guard.
  if (isEditModalVisible.value) {
    closeEditModal();
  } else if (isPasswordModalVisible.value) {
    closePasswordModal();
  } else if (isUndoConfirmVisible.value) {
    cancelUndoConfirm();
  } else if (isSyncConfirmVisible.value) {
    cancelSyncConfirm();
  }
}

onMounted(() => document.addEventListener('keydown', handleGlobalKeydown));
onBeforeUnmount(() =>
  document.removeEventListener('keydown', handleGlobalKeydown)
);
</script>

<template>
  <!-- ===== PHASE: CHOOSE ===== -->
  <section
    id="phase-choose"
    class="scroll-mt-24 lg:scroll-mt-8 max-w-4xl mx-auto px-4 py-8"
  >
    <header class="mb-6 flex items-center gap-3">
      <span
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
      >
        <Squares2X2Icon class="h-6 w-6" />
      </span>
      <div>
        <h2 class="font-serif text-2xl font-bold text-base-content">
          {{ $t('phase_choose') }}
        </h2>
        <p class="text-sm text-base-content/60">
          {{ $t('phase_choose_desc') }}
        </p>
      </div>
    </header>

    <div class="space-y-8">
      <!-- Preset cards -->
      <div>
        <h3 class="font-serif mb-4 text-lg font-semibold text-base-content">
          {{ $t('choose_preset_heading') }}
        </h3>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label
            v-for="option in presetOptions"
            :key="option.value"
            class="group relative flex cursor-pointer flex-col gap-2 rounded-xl border-2 bg-base-100 p-4 shadow-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary"
            :class="
              preset === option.value
                ? 'border-primary bg-primary/5'
                : 'border-base-300 hover:border-primary/40'
            "
          >
            <input
              type="radio"
              :value="option.value"
              v-model="preset"
              class="sr-only"
            />
            <div class="flex items-start justify-between gap-2">
              <span class="font-semibold text-base-content">
                {{ $t(option.label) }}
              </span>
              <CheckCircleIcon
                class="h-6 w-6 shrink-0 text-primary transition-opacity"
                :class="preset === option.value ? 'opacity-100' : 'opacity-0'"
              />
            </div>
            <p class="text-sm text-base-content/60">
              {{ $t(option.details) }}
            </p>
          </label>
        </div>
      </div>

      <!-- Language -->
      <div>
        <h3 class="font-serif mb-4 text-lg font-semibold text-base-content">
          {{ $t('choose_language_heading') }}
        </h3>
        <fieldset
          class="rounded-xl border border-base-300 bg-base-100 p-6 shadow-sm"
        >
          <div class="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            <label
              v-for="option in languageOptions"
              :key="option.value"
              class="label cursor-pointer"
            >
              <input
                type="radio"
                :value="option.value"
                v-model="language"
                class="radio radio-primary"
              />
              <span class="label-text ml-2"
                >{{ option.flag }} {{ $t(option.label) }}</span
              >
            </label>
          </div>
        </fieldset>
      </div>
    </div>
  </section>

  <!-- ===== PHASE: CUSTOMIZE ===== -->
  <section
    id="phase-customize"
    class="scroll-mt-24 lg:scroll-mt-8 max-w-4xl mx-auto px-4 py-8"
  >
    <header class="mb-6 flex items-center gap-3">
      <span
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
      >
        <AdjustmentsHorizontalIcon class="h-6 w-6" />
      </span>
      <div>
        <h2 class="font-serif text-2xl font-bold text-base-content">
          {{ $t('phase_customize') }}
        </h2>
        <p class="text-sm text-base-content/60">
          {{ $t('phase_customize_desc') }}
        </p>
      </div>
    </header>

    <form class="space-y-6" onsubmit="return false;">
      <!-- Debrid API Key -->
      <fieldset
        class="rounded-xl border border-base-300 bg-base-100 p-6 shadow-sm"
      >
        <legend class="font-serif px-2 text-base font-semibold">
          {{ $t('customize_debrid_heading') }}
          <a href="#debrid" class="inline-block align-middle">
            <QuestionMarkCircleIcon class="h-5 w-5 text-primary align-middle" />
          </a>
        </legend>

        <div class="form-control w-full space-y-3">
          <div class="space-y-2 pt-2">
            <div
              v-for="(entry, idx) in debridEntries"
              :key="idx"
              class="flex flex-col gap-1"
            >
              <label :for="`debrid-key-${idx}`" class="label-text font-medium">
                {{ $t('label_debrid_key') }}
              </label>
              <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  v-model="entry.service"
                  :ref="(el) => setDebridServiceRef(idx, el)"
                  @change="() => resetEntryKey(idx)"
                  class="select select-bordered w-full sm:w-40"
                >
                  <option value="">{{ $t('none') }}</option>
                  <option
                    v-for="(info, key) in debridServicesInfo"
                    :key="key"
                    :value="key"
                  >
                    {{ info.label || key }}
                  </option>
                </select>

                <input
                  :id="`debrid-key-${idx}`"
                  v-model="entry.key"
                  :disabled="!entry.service"
                  :aria-invalid="
                    !!(entry.key && !isValidApiKey(entry.service, entry.key))
                  "
                  :aria-describedby="
                    entry.key && !isValidApiKey(entry.service, entry.key)
                      ? `debrid-key-error-${idx}`
                      : undefined
                  "
                  :class="{
                    'input-error':
                      entry.key && !isValidApiKey(entry.service, entry.key)
                  }"
                  type="text"
                  class="input input-bordered min-w-0 flex-1 font-mono text-sm"
                  :placeholder="$t('enter_api_key')"
                />

                <button
                  type="button"
                  class="btn btn-sm btn-error min-h-[44px] min-w-[44px] text-white"
                  @click="removeDebridEntry(idx)"
                  :disabled="idx === 0"
                  :class="{ 'opacity-50 cursor-not-allowed': idx === 0 }"
                  :aria-label="$t('aria_remove_entry')"
                >
                  <MinusIcon class="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              <div class="flex w-full items-center justify-between gap-2">
                <span
                  :id="`debrid-key-error-${idx}`"
                  class="label-text-alt text-error text-xs"
                  :class="{
                    invisible: !(
                      entry.key && !isValidApiKey(entry.service, entry.key)
                    )
                  }"
                >
                  {{ $t('invalid_debrid_api_key') }}
                </span>

                <a
                  :href="debridServicesInfo[entry.service]?.url || '#'"
                  target="_blank"
                  class="link link-primary text-sm"
                  :class="{
                    invisible: !(
                      entry.service && debridServicesInfo[entry.service]?.url
                    )
                  }"
                  rel="noreferrer noopener"
                >
                  {{ $t('get_api_key_here') }}
                </a>
              </div>
            </div>

            <div class="flex justify-end items-center gap-2">
              <button
                type="button"
                class="btn btn-primary min-h-[44px] min-w-[44px]"
                @click="addDebridEntry"
                :disabled="!canAddDebridEntry"
                :aria-label="$t('aria_add_entry')"
              >
                <PlusIcon class="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </fieldset>

      <!-- Additional Addons -->
      <fieldset
        class="rounded-xl border border-base-300 bg-base-100 p-6 shadow-sm"
      >
        <legend class="font-serif px-2 text-base font-semibold">
          {{ $t('customize_addons_heading') }}
        </legend>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          <label class="label cursor-pointer">
            <input
              type="checkbox"
              value="kitsu"
              v-model="extras"
              class="checkbox checkbox-primary"
            />
            <span class="label-text ml-2">Anime Kitsu</span>
          </label>
          <label class="label cursor-pointer">
            <input
              type="checkbox"
              value="usatv"
              v-model="extras"
              class="checkbox checkbox-primary"
            />
            <span class="label-text ml-2">USA TV</span>
          </label>
          <label class="label cursor-pointer">
            <input
              type="checkbox"
              value="argentinatv"
              v-model="extras"
              class="checkbox checkbox-primary"
            />
            <span class="label-text ml-2">Argentina TV</span>
          </label>
          <label class="label cursor-pointer">
            <input
              type="checkbox"
              value="stremthrustore"
              :disabled="!isDebridApiKeyValid"
              v-model="extras"
              class="checkbox checkbox-primary"
            />
            <span class="label-text ml-2">StremThru Store</span>
          </label>
        </div>
      </fieldset>

      <!-- Custom Addons -->
      <fieldset
        class="rounded-xl border border-base-300 bg-base-100 p-6 shadow-sm"
      >
        <legend
          class="font-serif inline-flex items-center gap-1 px-2 text-base font-semibold"
        >
          {{ $t('customize_custom_heading') }}
          <VTooltip
            placement="auto"
            :triggers="['hover', 'click', 'touch']"
            :auto-hide="true"
            @click.stop
          >
            <QuestionMarkCircleIcon
              class="h-5 w-5 text-primary shrink-0 cursor-pointer"
            />
            <template #popper>
              <div class="text-sm max-w-xs">
                {{ $t('custom_addons_details') }}
              </div>
            </template>
          </VTooltip>
        </legend>
        <div class="space-y-3">
          <div
            v-for="(url, idx) in customAddons"
            :key="idx"
            class="flex flex-col gap-1"
          >
            <label :for="`custom-addon-${idx}`" class="label-text font-medium">
              {{ $t('label_custom_addon') }}
            </label>
            <div class="flex items-center gap-2">
              <input
                :id="`custom-addon-${idx}`"
                v-model="customAddons[idx]"
                type="text"
                class="input input-bordered min-w-0 flex-1 font-mono text-sm"
                :class="{
                  'input-error': url && !isValidManifestUrl(url)
                }"
                :placeholder="$t('custom_addon_url')"
              />
              <button
                type="button"
                class="btn btn-sm btn-error min-h-[44px] min-w-[44px] text-white"
                @click="removeCustomAddon(idx)"
                :aria-label="$t('aria_remove_entry')"
                :disabled="idx === 0"
                :class="{ 'opacity-50 cursor-not-allowed': idx === 0 }"
              >
                <MinusIcon class="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div class="flex justify-end items-center gap-2">
            <button
              type="button"
              class="btn btn-primary min-h-[44px] min-w-[44px]"
              @click="addCustomAddon"
              :disabled="
                !canAddCustom ||
                !isValidManifestUrl(customAddons[customAddons.length - 1])
              "
              :aria-label="$t('aria_add_entry')"
            >
              <PlusIcon class="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </fieldset>

      <!-- Additional Options -->
      <fieldset
        class="rounded-xl border border-base-300 bg-base-100 p-6 shadow-sm"
      >
        <legend class="font-serif px-2 text-base font-semibold">
          {{ $t('customize_options_heading') }}
        </legend>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          <label class="label cursor-pointer">
            <input
              type="checkbox"
              value="no4k"
              v-model="options"
              class="checkbox checkbox-primary"
            />
            <span class="label-text ml-2">{{ $t('no_4k') }}</span>
          </label>
          <label class="label cursor-pointer">
            <input
              type="checkbox"
              value="cached"
              v-model="options"
              :disabled="!isDebridApiKeyValid"
              class="checkbox checkbox-primary"
            />
            <span class="label-text ml-2">{{ $t('cached_only_debrid') }}</span>
          </label>
          <label class="label cursor-pointer">
            <input
              type="checkbox"
              value="min720p"
              v-model="options"
              class="checkbox checkbox-primary"
            />
            <span class="label-text ml-2">{{ $t('minimum_720p') }}</span>
          </label>
          <label class="label cursor-pointer">
            <input
              type="checkbox"
              value="excludeAnime"
              v-model="options"
              class="checkbox checkbox-primary"
            />
            <span class="label-text ml-2">{{ $t('exclude_anime') }}</span>
          </label>
          <label class="label cursor-pointer">
            <span class="label-text">{{ $t('max_size') }}</span>
            <select v-model="maxSize" class="select select-bordered w-32">
              <option :value="''">{{ $t('no_size_limit') }}</option>
              <option
                v-for="size in [2, 5, 10, 15, 20, 25, 30]"
                :key="size"
                :value="size"
              >
                {{ size }} GB
              </option>
            </select>
          </label>
          <label class="label cursor-pointer">
            <input
              type="checkbox"
              value="kids"
              v-model="options"
              class="checkbox checkbox-primary"
            />
            <span class="label-text ml-2 flex items-center gap-1">
              {{ $t('kids') }}
              <VTooltip
                placement="auto"
                :triggers="['hover', 'click', 'touch']"
                :auto-hide="true"
                @click.stop
              >
                <QuestionMarkCircleIcon
                  class="h-5 w-5 text-primary shrink-0 cursor-pointer"
                />
                <template #popper>
                  <div class="text-sm max-w-xs">
                    {{ $t('kids_option_details') }}
                  </div>
                </template>
              </VTooltip>
            </span>
          </label>
          <label v-if="props.platform === 'nuvio'" class="label cursor-pointer">
            <span class="label-text">{{ $t('profile_label') }}</span>
            <select
              v-model.number="selectedNuvioProfileId"
              class="select select-bordered w-40"
              :disabled="isLoadingNuvioProfiles || nuvioProfiles.length === 0"
            >
              <option v-if="isLoadingNuvioProfiles" :value="1">
                {{ $t('profile_loading') }}
              </option>
              <option
                v-for="profile in nuvioProfiles"
                :key="profile.id"
                :value="profile.id"
              >
                {{ profile.name }}
              </option>
            </select>
          </label>
        </div>
      </fieldset>

      <!-- Advanced API keys (collapsed by default) -->
      <div
        class="collapse collapse-arrow rounded-xl border border-base-300 bg-base-100 shadow-sm"
        :class="{ 'collapse-open': isAdvancedKeysOpen }"
      >
        <div
          class="collapse-title flex items-center gap-3"
          role="button"
          tabindex="0"
          :aria-expanded="isAdvancedKeysOpen"
          aria-controls="advanced-keys-content"
          @click="isAdvancedKeysOpen = !isAdvancedKeysOpen"
          @keydown.enter.prevent="isAdvancedKeysOpen = !isAdvancedKeysOpen"
          @keydown.space.prevent="isAdvancedKeysOpen = !isAdvancedKeysOpen"
        >
          <KeyIcon class="h-5 w-5 shrink-0 text-primary" />
          <div>
            <p class="font-serif text-base font-semibold text-base-content">
              {{ $t('advanced_keys_title') }}
            </p>
            <p class="text-sm text-base-content/60">
              {{ $t('advanced_keys_desc') }}
            </p>
          </div>
        </div>
        <div id="advanced-keys-content" class="collapse-content">
          <div
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2"
          >
            <div class="flex flex-col gap-1">
              <label for="adv-rpdbKey" class="label-text font-medium">
                {{ $t('label_rpdb_key') }}
              </label>
              <div class="flex items-center gap-2">
                <input
                  id="adv-rpdbKey"
                  :ref="(el) => setAdvancedKeyInputRef('rpdbKey', el)"
                  v-model="advancedOptions.rpdbKey"
                  class="input input-bordered min-w-0 w-full font-mono text-sm"
                  :placeholder="$t('enter_rpdb_key')"
                />
                <VTooltip
                  placement="auto"
                  :triggers="['hover', 'click', 'touch']"
                  :auto-hide="true"
                  @click.stop
                >
                  <a
                    target="_blank"
                    href="https://ratingposterdb.com"
                    rel="noreferrer noopener"
                    class="inline-block align-middle"
                    :aria-label="
                      $t('aria_help_about', { service: 'RatingPosterDB' })
                    "
                  >
                    <QuestionMarkCircleIcon class="h-5 w-5 text-primary" />
                  </a>
                  <template #popper>
                    <div class="text-sm max-w-xs">
                      {{ $t('help_rpdb_key') }}
                    </div>
                  </template>
                </VTooltip>
              </div>
            </div>

            <div class="flex flex-col gap-1">
              <label for="adv-tmdbKey" class="label-text font-medium">
                {{ $t('label_tmdb_key') }}
              </label>
              <div class="flex items-center gap-2">
                <input
                  id="adv-tmdbKey"
                  :ref="(el) => setAdvancedKeyInputRef('tmdbKey', el)"
                  v-model="advancedOptions.tmdbKey"
                  class="input input-bordered min-w-0 w-full font-mono text-sm"
                  :placeholder="$t('enter_tmdb_key')"
                />
                <VTooltip
                  placement="auto"
                  :triggers="['hover', 'click', 'touch']"
                  :auto-hide="true"
                  @click.stop
                >
                  <a
                    target="_blank"
                    href="https://www.themoviedb.org/settings/api"
                    rel="noreferrer noopener"
                    class="inline-block align-middle"
                    :aria-label="$t('aria_help_about', { service: 'TMDB' })"
                  >
                    <QuestionMarkCircleIcon class="h-5 w-5 text-primary" />
                  </a>
                  <template #popper>
                    <div class="text-sm max-w-xs">
                      {{ $t('help_tmdb_key') }}
                    </div>
                  </template>
                </VTooltip>
              </div>
            </div>

            <div class="flex flex-col gap-1">
              <label for="adv-tmdbAccessToken" class="label-text font-medium">
                {{ $t('label_tmdb_access_token') }}
              </label>
              <div class="flex items-center gap-2">
                <input
                  id="adv-tmdbAccessToken"
                  :ref="(el) => setAdvancedKeyInputRef('tmdbAccessToken', el)"
                  v-model="advancedOptions.tmdbAccessToken"
                  class="input input-bordered min-w-0 w-full font-mono text-sm"
                  :placeholder="$t('enter_tmdb_access_token')"
                />
                <VTooltip
                  placement="auto"
                  :triggers="['hover', 'click', 'touch']"
                  :auto-hide="true"
                  @click.stop
                >
                  <a
                    target="_blank"
                    href="https://www.themoviedb.org/settings/api"
                    rel="noreferrer noopener"
                    class="inline-block align-middle"
                    :aria-label="$t('aria_help_about', { service: 'TMDB' })"
                  >
                    <QuestionMarkCircleIcon class="h-5 w-5 text-primary" />
                  </a>
                  <template #popper>
                    <div class="text-sm max-w-xs">
                      {{ $t('help_tmdb_access_token') }}
                    </div>
                  </template>
                </VTooltip>
              </div>
            </div>

            <div class="flex flex-col gap-1">
              <label for="adv-tvdbKey" class="label-text font-medium">
                {{ $t('label_tvdb_key') }}
              </label>
              <div class="flex items-center gap-2">
                <input
                  id="adv-tvdbKey"
                  :ref="(el) => setAdvancedKeyInputRef('tvdbKey', el)"
                  v-model="advancedOptions.tvdbKey"
                  class="input input-bordered min-w-0 w-full font-mono text-sm"
                  :placeholder="$t('enter_tvdb_key')"
                />
                <VTooltip
                  placement="auto"
                  :triggers="['hover', 'click', 'touch']"
                  :auto-hide="true"
                  @click.stop
                >
                  <a
                    target="_blank"
                    href="https://thetvdb.com/api-information"
                    rel="noreferrer noopener"
                    class="inline-block align-middle"
                    :aria-label="$t('aria_help_about', { service: 'TheTVDB' })"
                  >
                    <QuestionMarkCircleIcon class="h-5 w-5 text-primary" />
                  </a>
                  <template #popper>
                    <div class="text-sm max-w-xs">
                      {{ $t('help_tvdb_key') }}
                    </div>
                  </template>
                </VTooltip>
              </div>
            </div>

            <div class="flex flex-col gap-1">
              <label for="adv-fanartKey" class="label-text font-medium">
                {{ $t('label_fanart_key') }}
              </label>
              <div class="flex items-center gap-2">
                <input
                  id="adv-fanartKey"
                  :ref="(el) => setAdvancedKeyInputRef('fanartKey', el)"
                  v-model="advancedOptions.fanartKey"
                  class="input input-bordered min-w-0 w-full font-mono text-sm"
                  :placeholder="$t('enter_fanart_key')"
                />
                <VTooltip
                  placement="auto"
                  :triggers="['hover', 'click', 'touch']"
                  :auto-hide="true"
                  @click.stop
                >
                  <a
                    target="_blank"
                    href="https://fanart.tv"
                    rel="noreferrer noopener"
                    class="inline-block align-middle"
                    :aria-label="
                      $t('aria_help_about', { service: 'Fanart.tv' })
                    "
                  >
                    <QuestionMarkCircleIcon class="h-5 w-5 text-primary" />
                  </a>
                  <template #popper>
                    <div class="text-sm max-w-xs">
                      {{ $t('help_fanart_key') }}
                    </div>
                  </template>
                </VTooltip>
              </div>
            </div>

            <div class="flex flex-col gap-1">
              <label for="adv-geminiKey" class="label-text font-medium">
                {{ $t('label_gemini_key') }}
              </label>
              <div class="flex items-center gap-2">
                <input
                  id="adv-geminiKey"
                  :ref="(el) => setAdvancedKeyInputRef('geminiKey', el)"
                  v-model="advancedOptions.geminiKey"
                  class="input input-bordered min-w-0 w-full font-mono text-sm"
                  :placeholder="$t('enter_gemini_key')"
                />
                <VTooltip
                  placement="auto"
                  :triggers="['hover', 'click', 'touch']"
                  :auto-hide="true"
                  @click.stop
                >
                  <a
                    target="_blank"
                    href="https://aistudio.google.com"
                    rel="noreferrer noopener"
                    class="inline-block align-middle"
                    :aria-label="
                      $t('aria_help_about', { service: 'Google Gemini' })
                    "
                  >
                    <QuestionMarkCircleIcon class="h-5 w-5 text-primary" />
                  </a>
                  <template #popper>
                    <div class="text-sm max-w-xs">
                      {{ $t('help_gemini_key') }}
                    </div>
                  </template>
                </VTooltip>
              </div>
            </div>

            <div class="flex flex-col gap-1">
              <label for="adv-topPosterKey" class="label-text font-medium">
                {{ $t('label_top_poster_key') }}
              </label>
              <div class="flex items-center gap-2">
                <input
                  id="adv-topPosterKey"
                  :ref="(el) => setAdvancedKeyInputRef('topPosterKey', el)"
                  v-model="advancedOptions.topPosterKey"
                  class="input input-bordered min-w-0 w-full font-mono text-sm"
                  :placeholder="$t('enter_top_poster_key')"
                />
                <VTooltip
                  placement="auto"
                  :triggers="['hover', 'click', 'touch']"
                  :auto-hide="true"
                  @click.stop
                >
                  <a
                    target="_blank"
                    href="https://api.top-streaming.stream/user/dashboard"
                    rel="noreferrer noopener"
                    class="inline-block align-middle"
                    :aria-label="
                      $t('aria_help_about', { service: 'TOP Posters' })
                    "
                  >
                    <QuestionMarkCircleIcon class="h-5 w-5 text-primary" />
                  </a>
                  <template #popper>
                    <div class="text-sm max-w-xs">
                      {{ $t('help_top_poster_key') }}
                    </div>
                  </template>
                </VTooltip>
              </div>
            </div>

            <div class="flex flex-col gap-1">
              <label for="adv-mdblistKey" class="label-text font-medium">
                {{ $t('label_mdblist_key') }}
              </label>
              <div class="flex items-center gap-2">
                <input
                  id="adv-mdblistKey"
                  :ref="(el) => setAdvancedKeyInputRef('mdblistKey', el)"
                  v-model="advancedOptions.mdblistKey"
                  class="input input-bordered min-w-0 w-full font-mono text-sm"
                  :placeholder="$t('enter_mdblist_key')"
                />
                <VTooltip
                  placement="auto"
                  :triggers="['hover', 'click', 'touch']"
                  :auto-hide="true"
                  @click.stop
                >
                  <a
                    target="_blank"
                    href="https://mdblist.com/preferences"
                    rel="noreferrer noopener"
                    class="inline-block align-middle"
                    :aria-label="$t('aria_help_about', { service: 'MDBList' })"
                  >
                    <QuestionMarkCircleIcon class="h-5 w-5 text-primary" />
                  </a>
                  <template #popper>
                    <div class="text-sm max-w-xs">
                      {{ $t('help_mdblist_key') }}
                    </div>
                  </template>
                </VTooltip>
              </div>
            </div>

            <div class="flex flex-col gap-1">
              <label for="adv-publicMetaDbKey" class="label-text font-medium">
                {{ $t('label_publicmetadb_key') }}
              </label>
              <div class="flex items-center gap-2">
                <input
                  id="adv-publicMetaDbKey"
                  :ref="(el) => setAdvancedKeyInputRef('publicMetaDbKey', el)"
                  v-model="advancedOptions.publicMetaDbKey"
                  class="input input-bordered min-w-0 w-full font-mono text-sm"
                  :placeholder="$t('enter_publicmetadb_key')"
                />
                <VTooltip
                  placement="auto"
                  :triggers="['hover', 'click', 'touch']"
                  :auto-hide="true"
                  @click.stop
                >
                  <a
                    target="_blank"
                    href="https://publicmetadb.com"
                    rel="noreferrer noopener"
                    class="inline-block align-middle"
                    :aria-label="
                      $t('aria_help_about', { service: 'PublicMetaDB' })
                    "
                  >
                    <QuestionMarkCircleIcon class="h-5 w-5 text-primary" />
                  </a>
                  <template #popper>
                    <div class="text-sm max-w-xs">
                      {{ $t('help_publicmetadb_key') }}
                    </div>
                  </template>
                </VTooltip>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Keys & Health: optional validation of the keys entered above -->
      <ApiHealthPanel
        :debrid-entries="debridEntries"
        :advanced="advancedOptions"
        @focus-field="focusHealthField"
      />

      <!-- Load preset (generates the addon list reviewed in the next phase) -->
      <fieldset
        class="rounded-xl border border-base-300 bg-base-100 p-6 shadow-sm"
      >
        <legend class="font-serif px-2 text-base font-semibold">
          {{ $t('step8_load_preset') }}
        </legend>
        <div class="flex flex-col gap-3 md:flex-row md:items-center">
          <button
            class="btn btn-primary"
            @click="loadUserAddons"
            :disabled="
              !props.authKey ||
              (hasDebridSelected && !isDebridApiKeyValid) ||
              isLoadingPreset
            "
          >
            <span
              v-if="isLoadingPreset"
              class="loading loading-spinner loading-sm"
            ></span>
            {{ isLoadingPreset ? $t('loading_addons') : $t('generate_addons') }}
          </button>

          <button
            type="button"
            class="btn btn-outline"
            @click="loadCurrentAccountAddons"
            :disabled="!props.authKey || isLoadingCurrentAccount"
          >
            <span
              v-if="isLoadingCurrentAccount"
              class="loading loading-spinner loading-sm"
            ></span>
            {{
              isLoadingCurrentAccount
                ? $t('importing_from_account', { platform: platformLabel })
                : $t('import_from_account', { platform: platformLabel })
            }}
          </button>
        </div>
        <p class="mt-3 text-xs text-base-content/60">
          {{ $t('generate_addons_hint') }}
        </p>
        <p
          v-if="hasDebridSelected && !isDebridApiKeyValid"
          class="mt-1 text-xs text-error"
        >
          {{ $t('load_preset_disabled_hint') }}
        </p>
      </fieldset>
    </form>
  </section>

  <!-- ===== PHASE: REVIEW & APPLY ===== -->
  <section
    id="phase-review"
    class="scroll-mt-24 lg:scroll-mt-8 max-w-4xl mx-auto px-4 py-8"
  >
    <header class="mb-6 flex items-center gap-3">
      <span
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
      >
        <ListBulletIcon class="h-6 w-6" />
      </span>
      <div>
        <h2 class="font-serif text-2xl font-bold text-base-content">
          {{ $t('phase_review') }}
        </h2>
        <p class="text-sm text-base-content/60">
          {{ $t('phase_review_desc') }}
        </p>
      </div>
    </header>

    <!-- Account snapshot (informational) -->
    <div
      v-if="accountSnapshot"
      class="mb-6 rounded-xl border border-info/30 bg-info/10 p-4"
    >
      <p class="font-semibold text-info">
        {{ $t('account_snapshot_title', { platform: platformLabel }) }}
      </p>
      <p class="mt-1 text-sm">
        {{
          $t('account_snapshot_desc', {
            count: accountSnapshot.addonCount,
            platform: platformLabel
          })
        }}
      </p>
      <div
        v-if="accountSnapshot.addonNames?.length"
        class="mt-3 flex flex-wrap gap-2"
      >
        <span
          v-for="name in accountSnapshot.addonNames.slice(0, 10)"
          :key="name"
          class="badge badge-outline"
        >
          {{ name }}
        </span>
        <span
          v-if="accountSnapshot.addonNames.length > 10"
          class="badge badge-ghost"
        >
          +{{ accountSnapshot.addonNames.length - 10 }} {{ $t('more') }}
        </span>
      </div>
      <div
        v-if="accountSnapshot.missingAddonNames?.length"
        class="mt-3 rounded border border-warning/40 bg-warning/10 p-3 text-sm"
      >
        <p class="font-semibold text-warning">
          Missing after account verification
        </p>
        <ul class="mt-2 list-disc pl-5">
          <li v-for="name in accountSnapshot.missingAddonNames" :key="name">
            {{ name }}
          </li>
        </ul>
      </div>
    </div>

    <div class="space-y-6">
      <!-- Customize addons list -->
      <fieldset
        class="rounded-xl border border-base-300 bg-base-100 p-6 shadow-sm"
      >
        <legend class="font-serif px-2 text-base font-semibold">
          {{ $t('step9_customize_addons') }}
        </legend>
        <p v-if="addons.length === 0" class="mb-3 text-sm text-base-content/60">
          {{ $t('addons_empty', { platform: platformLabel }) }}
        </p>
        <div
          v-if="addonBuildErrors.length > 0"
          class="alert alert-warning mb-3 flex-col items-start"
          role="alert"
        >
          <p class="font-semibold">{{ $t('addon_build_errors_title') }}</p>
          <ul class="list-disc pl-5 text-sm">
            <li v-for="(error, idx) in addonBuildErrors" :key="idx">
              {{ error }}
            </li>
          </ul>
        </div>
        <draggable
          :list="addons"
          item-key="transportUrl"
          class="space-y-2"
          ghost-class="opacity-50"
          @start="dragging = true"
          @end="dragging = false"
        >
          <template #item="{ element, index }">
            <AddonItem
              :name="element.manifest.name"
              :idx="index"
              :manifestURL="element.transportUrl"
              :logoURL="element.manifest.logo"
              :isDeletable="
                !getNestedObjectProperty(element, 'flags.protected', false)
              "
              :isConfigurable="
                getNestedObjectProperty(
                  element,
                  'manifest.behaviorHints.configurable',
                  false
                )
              "
              @delete-addon="removeAddon"
              @edit-manifest="openEditModal"
            />
          </template>
        </draggable>
      </fieldset>

      <!-- Bootstrap / Sync -->
      <fieldset
        class="rounded-xl border border-base-300 bg-base-100 p-6 shadow-sm"
      >
        <legend class="font-serif px-2 text-base font-semibold">
          {{ $t('step10_bootstrap_account') }}
        </legend>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            class="btn btn-primary"
            :disabled="
              !isSyncButtonEnabled ||
              isLoadingPreset ||
              isSyncAddons ||
              isPreparingSync ||
              isUndoingSync
            "
            @click="syncUserAddons"
          >
            <span
              v-if="isSyncAddons || isPreparingSync"
              class="loading loading-spinner loading-sm"
            ></span>
            {{
              isSyncAddons
                ? $t('sync_addons')
                : isPreparingSync
                  ? $t('sync_diff_loading')
                  : $t('sync_to_stremio', { platform: platformLabel })
            }}
          </button>

          <button
            type="button"
            class="btn btn-outline"
            :disabled="!lastSyncSnapshot || isUndoingSync || isSyncAddons"
            @click="requestUndoLastSync"
          >
            <span
              v-if="isUndoingSync"
              class="loading loading-spinner loading-sm"
            ></span>
            {{ isUndoingSync ? $t('undoing_sync') : $t('undo_last_sync') }}
          </button>
        </div>
        <p class="mt-3 text-xs text-warning">
          {{ $t('sync_overwrites_hint') }}
        </p>
        <p class="mt-1 text-xs text-base-content/60">
          {{ $t('undo_last_sync_hint') }}
        </p>
      </fieldset>

      <!-- Tools disclosure: builder settings export/import (subordinate) -->
      <div
        class="collapse collapse-arrow rounded-xl border border-base-300 bg-base-200/60"
      >
        <input type="checkbox" />
        <div class="collapse-title flex items-center gap-3">
          <span
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
          >
            <Cog6ToothIcon class="h-5 w-5" />
          </span>
          <div>
            <p class="font-serif text-base font-semibold text-base-content">
              {{ $t('tools_title') }}
            </p>
            <p class="text-sm text-base-content/60">{{ $t('tools_desc') }}</p>
          </div>
        </div>
        <div class="collapse-content">
          <div class="pt-2">
            <div
              class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"
            >
              <div class="space-y-1">
                <p class="text-base font-semibold">
                  {{ $t('builder_form_file_title') }}
                </p>
                <p class="text-sm text-base-content/60">
                  {{ $t('builder_form_file_desc') }}
                </p>
                <div
                  v-if="lastBuilderSettingsImport"
                  class="mt-3 flex flex-wrap items-center gap-2 text-sm"
                >
                  <span class="badge badge-success">Applied</span>
                  <span>{{ lastBuilderSettingsImport.fileName }}</span>
                  <span
                    v-for="service in lastBuilderSettingsImport.debridServices"
                    :key="service"
                    class="badge badge-outline"
                  >
                    {{ debridServicesInfo[service]?.label || service }}
                  </span>
                </div>
              </div>

              <div class="flex shrink-0 flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  class="btn btn-outline"
                  @click="exportBuilderSettings"
                >
                  {{ $t('builder_export') }}
                </button>
                <button
                  type="button"
                  class="btn btn-primary"
                  @click="openBuilderSettingsFilePicker"
                >
                  {{ $t('builder_import') }}
                </button>
                <input
                  ref="builderSettingsFileInputRef"
                  type="file"
                  accept=".json,application/json"
                  class="hidden"
                  @change="importBuilderSettingsFile"
                />
              </div>
            </div>
            <p class="mt-3 text-xs text-warning">
              {{ $t('builder_form_contains_secrets') }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Pre-sync diff confirmation modal -->
  <dialog v-if="isSyncConfirmVisible" class="modal modal-open">
    <div
      ref="syncDiffDialogRef"
      class="modal-box w-11/12 max-w-2xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sync-confirm-title"
    >
      <button
        class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
        @click="cancelSyncConfirm"
      >
        ✕
      </button>
      <h3 id="sync-confirm-title" class="font-bold text-lg mb-2">
        {{ $t('sync_confirm_title') }}
      </h3>
      <p class="mb-4 text-sm opacity-80">
        {{ $t('sync_confirm_message', { platform: platformLabel }) }}
      </p>

      <div v-if="syncDiff" class="space-y-4">
        <div class="flex flex-wrap gap-2">
          <span class="badge badge-success">
            {{ $t('sync_diff_added') }}: {{ syncDiff.added.length }}
          </span>
          <span class="badge badge-error">
            {{ $t('sync_diff_removed') }}: {{ syncDiff.removed.length }}
          </span>
          <span class="badge badge-ghost">
            {{ $t('sync_diff_kept') }}: {{ syncDiff.kept.length }}
          </span>
          <span v-if="syncDiff.reordered" class="badge badge-warning">
            {{ $t('sync_diff_reordered') }}
          </span>
        </div>

        <div v-if="syncDiff.added.length > 0">
          <p class="font-semibold text-success">{{ $t('sync_diff_added') }}</p>
          <ul class="mt-1 list-disc pl-5 text-sm">
            <li v-for="name in syncDiff.added" :key="`add-${name}`">
              {{ name }}
            </li>
          </ul>
        </div>

        <div v-if="syncDiff.removed.length > 0">
          <p class="font-semibold text-error">{{ $t('sync_diff_removed') }}</p>
          <ul class="mt-1 list-disc pl-5 text-sm">
            <li v-for="name in syncDiff.removed" :key="`rem-${name}`">
              {{ name }}
            </li>
          </ul>
        </div>

        <div v-if="syncDiff.kept.length > 0">
          <p class="font-semibold opacity-80">{{ $t('sync_diff_kept') }}</p>
          <div class="mt-1 flex flex-wrap gap-2">
            <span
              v-for="name in syncDiff.kept.slice(0, 12)"
              :key="`kept-${name}`"
              class="badge badge-outline"
            >
              {{ name }}
            </span>
            <span v-if="syncDiff.kept.length > 12" class="badge badge-ghost">
              +{{ syncDiff.kept.length - 12 }} {{ $t('more') }}
            </span>
          </div>
        </div>

        <p
          v-if="
            syncDiff.added.length === 0 &&
            syncDiff.removed.length === 0 &&
            !syncDiff.reordered
          "
          class="text-sm text-warning"
        >
          {{ $t('sync_diff_no_changes') }}
        </p>
      </div>

      <div class="modal-action">
        <button class="btn" @click="cancelSyncConfirm">
          {{ $t('cancel') }}
        </button>
        <button class="btn btn-primary" @click="confirmSyncUserAddons">
          {{ $t('sync_confirm_apply') }}
        </button>
      </div>
    </div>
  </dialog>

  <!-- Undo last sync confirmation modal -->
  <dialog v-if="isUndoConfirmVisible" class="modal modal-open">
    <div
      ref="undoDialogRef"
      class="modal-box"
      role="dialog"
      aria-modal="true"
      aria-labelledby="undo-confirm-title"
    >
      <button
        class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
        @click="cancelUndoConfirm"
      >
        ✕
      </button>
      <h3 id="undo-confirm-title" class="font-bold text-lg mb-2">
        {{ $t('undo_confirm_title') }}
      </h3>
      <p class="mb-4 text-sm opacity-80">
        {{ $t('undo_confirm_message', { platform: platformLabel }) }}
      </p>
      <div class="modal-action">
        <button class="btn" @click="cancelUndoConfirm">
          {{ $t('cancel') }}
        </button>
        <button class="btn btn-primary" @click="confirmUndoLastSync">
          {{ $t('undo_confirm_apply') }}
        </button>
      </div>
    </div>
  </dialog>

  <!-- Password Modal -->
  <dialog v-if="isPasswordModalVisible" class="modal modal-open">
    <div
      ref="passwordDialogRef"
      class="modal-box"
      role="dialog"
      aria-modal="true"
      aria-labelledby="password-modal-title"
    >
      <button
        class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
        :disabled="!passwordAcknowledged"
        @click="closePasswordModal"
      >
        ✕
      </button>
      <h3 id="password-modal-title" class="font-bold text-lg mb-4">
        {{ $t('password_title') }}
      </h3>
      <p class="mb-4">{{ $t('password_message') }}</p>
      <div
        class="bg-base-200 p-4 rounded-lg mb-4 font-mono text-center text-lg break-all"
      >
        {{ generatedPassword }}
      </div>
      <div class="flex flex-wrap gap-2 mb-4">
        <button class="btn btn-primary" @click="copyPassword">
          {{ $t('password_copy') }}
        </button>
        <button class="btn" @click="downloadPassword">
          {{ $t('password_download') }}
        </button>
      </div>
      <label class="label cursor-pointer justify-start gap-2 mb-2">
        <input
          v-model="passwordAcknowledged"
          type="checkbox"
          class="checkbox checkbox-sm"
        />
        <span class="label-text">{{ $t('password_acknowledge') }}</span>
      </label>
      <div class="modal-action">
        <button
          class="btn"
          :disabled="!passwordAcknowledged"
          @click="closePasswordModal"
        >
          {{ $t('close') }}
        </button>
      </div>
    </div>
  </dialog>

  <!-- Edit Modal -->
  <dialog v-if="isEditModalVisible" class="modal modal-open">
    <div
      ref="editDialogRef"
      class="modal-box w-11/12 max-w-5xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-manifest-title"
    >
      <button
        class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
        @click="closeEditModal"
      >
        ✕
      </button>
      <h3 id="edit-manifest-title" class="font-bold text-lg mb-4">
        {{ $t('edit_manifest') }}
      </h3>
      <DynamicForm
        :manifest="currentManifest"
        @update-manifest="saveManifestEdit"
      />
      <div class="modal-action">
        <button class="btn" @click="closeEditModal">{{ $t('close') }}</button>
      </div>
    </div>
  </dialog>
</template>
