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

const { authKey, platform } = defineProps({
  authKey: { type: String },
  platform: {
    type: String,
    default: 'stremio'
  }
});

const emit = defineEmits(['restored']);

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

function getAddonName(addon) {
  return addon?.manifest?.name || addon?.name || 'Unknown addon';
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
    fileName: file.name,
    platform,
    sourceFormat: backup.sourceFormat
  };
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
    const backup = parseAccountBackup(parsed);

    await setAddonCollection(platform, backup.addons, authKey);
    const restoreSummary = summarizeRestore(file, backup);
    lastRestore.value = restoreSummary;
    emit('restored', restoreSummary);
    addNotification(
      `${t('restore_successful')}: ${backup.addons.length} addons`,
      'success'
    );
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

        <p class="mt-3 text-xs text-warning">
          Restore already updated your account. The Configure form below starts
          from preset defaults and is not reverse-filled from private addon
          URLs.
        </p>
      </div>
    </div>
  </section>
</template>
