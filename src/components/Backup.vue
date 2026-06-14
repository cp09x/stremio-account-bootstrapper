<script setup>
import { computed, ref } from 'vue';
import { getAddonCollection, setAddonCollection } from '../api/platformApi';
import { format } from 'date-fns';
import { useI18n } from 'vue-i18n';
import { addNotification } from '../composables/useNotifications';
import { useAnalytics } from '../composables/useAnalytics';
import {
  buildBackupFilename,
  createAccountBackup,
  parseAccountBackup
} from '../services/accountBackup';
import {
  isBuilderSettingsBackup,
  parseBuilderSettingsBackup
} from '../services/builderSettingsBackup';
import { extractBuilderSettingsFromAddons } from '../services/builderSettingsFromAddons';
import { debridServicesInfo } from '../utils/debrid';

const { authKey, platform } = defineProps({
  authKey: { type: String },
  platform: {
    type: String,
    default: 'stremio'
  }
});

const emit = defineEmits(['restored', 'builder-settings']);

const { t } = useI18n();
const loadingBackup = ref(false);
const loadingRestore = ref(false);
const error = ref(null);
const fileInputRef = ref(null);
const lastRestore = ref(null);
const { track } = useAnalytics();

const platformLabel = computed(() =>
  platform === 'nuvio' ? 'Nuvio' : 'Stremio'
);

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

function getAddonName(addon) {
  return addon?.manifest?.name || addon?.name || 'Unknown addon';
}

function getAddonUrl(addon) {
  return typeof addon?.transportUrl === 'string'
    ? addon.transportUrl
    : addon?.url || '';
}

function summarizeMissingAddons(expectedAddons, actualAddons) {
  const actualUrls = new Set(actualAddons.map(getAddonUrl).filter(Boolean));

  return expectedAddons
    .filter((addon) => !actualUrls.has(getAddonUrl(addon)))
    .map(getAddonName);
}

function summarizeRestore(file, backup) {
  const addonNames =
    backup.metadata?.addonNames?.length > 0
      ? backup.metadata.addonNames
      : backup.addons.map(getAddonName);

  return {
    addonCount: backup.addons.length,
    addonNames,
    exportedAt: backup.metadata?.exportedAt || '',
    extractedDebridServices: [],
    fileName: file.name,
    keyExtractionMessage: '',
    missingAddonNames: [],
    platform,
    sourceFormat: backup.sourceFormat
  };
}

function getDebridServiceLabel(service) {
  return debridServicesInfo[service]?.label || service;
}

function backupConfig() {
  loadingBackup.value = true;
  error.value = null;

  getAddonCollection(platform, authKey)
    .then((data) => {
      const backup = createAccountBackup({
        addonCollection: data,
        platform
      });
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = buildBackupFilename({
        platform,
        prefix: `addons-config-${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}`
      });
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      addNotification(t('backup_saved'), 'success');
      track('backup_config_click', {
        title: `Backup config (${platform})`
      });
    })
    .catch((e) => {
      error.value = e?.message || String(e);
      addNotification(error.value || t('backup_failed'), 'error');
    })
    .finally(() => {
      loadingBackup.value = false;
    });
}

function openFilePicker() {
  if (!authKey) return;
  fileInputRef.value?.click();
}

async function restoreConfigFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!authKey) {
    event.target.value = '';
    return;
  }

  loadingRestore.value = true;
  error.value = null;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);

    if (isBuilderSettingsBackup(parsed)) {
      const settings = parseBuilderSettingsBackup(parsed);
      emit('builder-settings', {
        fileName: file.name,
        importedAt: new Date().toISOString(),
        settings
      });
      addNotification('Builder settings imported into the form', 'success');
      return;
    }

    const backup = parseAccountBackup(parsed);

    const restoreResponse = await setAddonCollection(
      platform,
      backup.addons,
      authKey
    );

    if (restoreResponse?.result?.success === false) {
      throw new Error(restoreResponse?.result?.error || 'Restore failed');
    }

    const restoreSummary = summarizeRestore(file, backup);
    const extractedBuilderSettings = extractBuilderSettingsFromAddons(
      backup.addons
    );
    restoreSummary.extractedDebridServices =
      extractedBuilderSettings.debridEntries.map((entry) =>
        getDebridServiceLabel(entry.service)
      );

    if (extractedBuilderSettings.debridEntries.length > 0) {
      emit('builder-settings', {
        fileName: `${file.name} (extracted from addon URLs)`,
        importedAt: new Date().toISOString(),
        settings: extractedBuilderSettings.settings
      });
      restoreSummary.keyExtractionMessage =
        'Editable debrid key fields were filled from recoverable private addon URLs.';
    } else {
      restoreSummary.keyExtractionMessage =
        'No recoverable debrid keys were found in this account-addon backup. The installed addons were restored, but the editable key fields cannot be filled from this file.';
    }

    const postRestoreCollection = await getAddonCollection(platform, authKey);
    const restoredAddons = extractAddonList(postRestoreCollection);
    const missingAddonNames = summarizeMissingAddons(
      backup.addons,
      restoredAddons
    );
    restoreSummary.missingAddonNames = missingAddonNames;

    lastRestore.value = restoreSummary;
    emit('restored', restoreSummary);

    if (missingAddonNames.length > 0) {
      addNotification(
        `${t('restore_successful')}, but ${missingAddonNames.length} addons were not found after verification`,
        'warning'
      );
    } else if (extractedBuilderSettings.debridEntries.length > 0) {
      addNotification(
        `${t('restore_successful')}: ${backup.addons.length} addons verified and ${extractedBuilderSettings.debridEntries.length} key fields filled`,
        'success'
      );
    } else {
      addNotification(
        `${t('restore_successful')}: ${backup.addons.length} addons verified`,
        'success'
      );
    }
    track('restore_config_click', {
      title: `Restore config (${platform})`,
      vars: {
        sourceFormat: backup.sourceFormat,
        addonCount: backup.addons.length
      }
    });
  } catch (e) {
    error.value = e?.message || String(e);
    addNotification(error.value || t('restore_failed'), 'error');
  } finally {
    loadingRestore.value = false;
    event.target.value = '';
  }
}
</script>

<template>
  <section id="backup" class="max-w-4xl mx-auto p-4">
    <h2 class="text-2xl font-bold mb-6">{{ $t('backup_restore') }}</h2>

    <div class="bg-base-100 p-6 rounded-lg border border-base-300">
      <div class="mb-4">
        <p class="font-semibold">Installed account addons</p>
        <p class="mt-1 text-sm opacity-75">
          Backup and restore the addon collection installed in your account. Use
          Configure → Builder settings when you need to export or import
          editable API keys and preset fields.
        </p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <button
            class="btn btn-primary w-full"
            @click="backupConfig"
            :disabled="!authKey || loadingBackup"
          >
            <span
              v-if="loadingBackup"
              class="loading loading-spinner loading-sm"
            ></span>
            {{ loadingBackup ? $t('backing_up') : $t('backup_config') }}
          </button>
        </div>

        <div>
          <button
            class="btn btn-secondary w-full"
            @click="openFilePicker"
            :disabled="!authKey || loadingRestore"
          >
            <span
              v-if="loadingRestore"
              class="loading loading-spinner loading-sm"
            ></span>
            {{ loadingRestore ? $t('restoring') : $t('restore_config') }}
          </button>

          <input
            ref="fileInputRef"
            type="file"
            accept=".json,application/json"
            @change="restoreConfigFile"
            class="hidden"
            :disabled="!authKey || loadingRestore"
          />
        </div>
      </div>
      <p class="text-xs text-warning mt-4">
        {{ $t('backup_contains_secrets') }}
      </p>

      <div
        v-if="lastRestore"
        class="mt-4 rounded-lg border border-success/30 bg-success/10 p-4"
      >
        <div class="flex flex-col gap-1">
          <p class="font-semibold text-success">
            Restored to {{ platformLabel }}
          </p>
          <p class="text-sm">
            {{ lastRestore.fileName }} · {{ lastRestore.addonCount }} addons
          </p>
          <p v-if="lastRestore.exportedAt" class="text-xs opacity-70">
            Exported at {{ lastRestore.exportedAt }}
          </p>
        </div>

        <div class="mt-3 flex flex-wrap gap-2">
          <span
            v-for="name in lastRestore.addonNames.slice(0, 12)"
            :key="name"
            class="badge badge-outline"
          >
            {{ name }}
          </span>
          <span
            v-if="lastRestore.addonNames.length > 12"
            class="badge badge-ghost"
          >
            +{{ lastRestore.addonNames.length - 12 }} more
          </span>
        </div>

        <div
          class="mt-3 rounded border p-3 text-sm"
          :class="
            lastRestore.extractedDebridServices.length > 0
              ? 'border-success/40 bg-success/10'
              : 'border-warning/40 bg-warning/10'
          "
        >
          <p
            class="font-semibold"
            :class="
              lastRestore.extractedDebridServices.length > 0
                ? 'text-success'
                : 'text-warning'
            "
          >
            {{
              lastRestore.extractedDebridServices.length > 0
                ? 'Builder keys filled'
                : 'No editable keys found'
            }}
          </p>
          <p class="mt-1 text-xs">
            {{ lastRestore.keyExtractionMessage }}
          </p>
          <div
            v-if="lastRestore.extractedDebridServices.length > 0"
            class="mt-2 flex flex-wrap gap-2"
          >
            <span
              v-for="service in lastRestore.extractedDebridServices"
              :key="service"
              class="badge badge-success badge-outline"
            >
              {{ service }}
            </span>
          </div>
          <p v-else class="mt-2 text-xs opacity-75">
            Import a Builder settings backup when you need the form to show API
            keys, provider choices, language, and preset fields.
          </p>
        </div>

        <div
          v-if="lastRestore.missingAddonNames.length > 0"
          class="mt-3 rounded border border-warning/40 bg-warning/10 p-3 text-sm"
        >
          <p class="font-semibold text-warning">
            Missing after account verification
          </p>
          <ul class="mt-2 list-disc pl-5">
            <li v-for="name in lastRestore.missingAddonNames" :key="name">
              {{ name }}
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>
