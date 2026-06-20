<script setup lang="ts">
import { computed, reactive, watch, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ShieldCheckIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon
} from '@heroicons/vue/24/outline';
import {
  validateKey,
  KEY_VALIDATORS,
  type HealthResult
} from '../services/apiHealth';

interface DebridEntry {
  service: string;
  key: string;
}

interface AdvancedKeys {
  rpdbKey?: string;
  tmdbKey?: string;
  tmdbAccessToken?: string;
  tvdbKey?: string;
  fanartKey?: string;
  geminiKey?: string;
  mdblistKey?: string;
  [key: string]: string | undefined;
}

const props = defineProps<{
  debridEntries: DebridEntry[];
  advanced: AdvancedKeys;
}>();

const emit = defineEmits<{
  (e: 'focus-field', id: string): void;
}>();

const { t } = useI18n();

type RowState = 'idle' | 'checking' | 'valid' | 'invalid' | 'error';

interface Row {
  id: string;
  label: string;
  key: string;
  reportsExpiry: boolean;
}

// Advanced-key property names map 1:1 onto validator ids.
const ADVANCED_IDS = [
  'rpdbKey',
  'tmdbKey',
  'tmdbAccessToken',
  'tvdbKey',
  'fanartKey',
  'geminiKey',
  'mdblistKey'
] as const;

// Per-id result cache, keyed by validator id (unique across the panel).
const results = reactive<Record<string, HealthResult>>({});
const states = reactive<Record<string, RowState>>({});

let controller: AbortController | null = null;

const testableRows = computed<Row[]>(() => {
  const rows: Row[] = [];

  // Debrid: only services that have a validator (torbox, realdebrid).
  for (const entry of props.debridEntries) {
    const def = entry.service && KEY_VALIDATORS[entry.service];
    if (!def) continue;
    const key = (entry.key || '').trim();
    if (!key) continue;
    rows.push({
      id: def.id,
      label: def.label,
      key,
      reportsExpiry: !!def.reportsExpiry
    });
  }

  // Advanced keys: property name === validator id.
  for (const id of ADVANCED_IDS) {
    const def = KEY_VALIDATORS[id];
    if (!def) continue;
    const key = (props.advanced?.[id] || '').trim();
    if (!key) continue;
    rows.push({
      id: def.id,
      label: def.label,
      key,
      reportsExpiry: !!def.reportsExpiry
    });
  }

  return rows;
});

// Tracks the key value last seen for each validator id. When the underlying key
// changes (the user corrected it), the cached state/result is stale, so we drop
// it and the row returns to untested.
const lastSeenKeys = reactive<Record<string, string>>({});

watch(
  testableRows,
  (rows) => {
    for (const row of rows) {
      if (
        lastSeenKeys[row.id] !== undefined &&
        lastSeenKeys[row.id] !== row.key
      ) {
        delete states[row.id];
        delete results[row.id];
      }
      lastSeenKeys[row.id] = row.key;
    }
  },
  { deep: true }
);

const summary = computed(() => {
  let valid = 0;
  let invalid = 0;
  let untested = 0;
  for (const row of testableRows.value) {
    const state = states[row.id];
    if (state === 'valid') valid++;
    else if (state === 'invalid' || state === 'error') invalid++;
    else untested++;
  }
  return { valid, invalid, untested };
});

const isTesting = computed(() =>
  testableRows.value.some((row) => states[row.id] === 'checking')
);

function ensureController(): AbortController {
  if (!controller) controller = new AbortController();
  return controller;
}

function cancelInFlight() {
  if (controller) {
    controller.abort();
    controller = null;
  }
  for (const row of testableRows.value) {
    if (states[row.id] === 'checking') states[row.id] = 'idle';
  }
}

async function runCheck(row: Row, signal: AbortSignal) {
  states[row.id] = 'checking';
  try {
    const result = await validateKey(row.id, row.key, signal);
    if (signal.aborted) return;
    results[row.id] = result;
    states[row.id] = result.status;
  } catch (e) {
    if (signal.aborted) return;
    results[row.id] = {
      status: 'error',
      message: e instanceof Error ? e.message : t('health_error_generic')
    };
    states[row.id] = 'error';
  }
}

async function testOne(row: Row) {
  // Re-clicking a checking row cancels everything in-flight.
  if (states[row.id] === 'checking') {
    cancelInFlight();
    return;
  }
  const signal = ensureController().signal;
  await runCheck(row, signal);
}

async function testAll() {
  if (isTesting.value) {
    cancelInFlight();
    return;
  }
  if (controller) controller.abort();
  controller = new AbortController();
  const signal = controller.signal;
  await Promise.all(testableRows.value.map((row) => runCheck(row, signal)));
}

onUnmounted(cancelInFlight);

function expiryLine(id: string): { text: string; urgent: boolean } | null {
  const result = results[id];
  if (!result || result.status !== 'valid' || !result.message) return null;
  const urgent = typeof result.daysLeft === 'number' && result.daysLeft <= 14;
  return { text: result.message, urgent };
}

function statusLabel(state: RowState | undefined): string {
  switch (state) {
    case 'checking':
      return t('health_status_checking');
    case 'valid':
      return t('health_status_valid');
    case 'invalid':
      return t('health_status_invalid');
    case 'error':
      return t('health_status_error');
    default:
      return t('health_status_untested');
  }
}
</script>

<template>
  <div
    class="rounded-xl border border-base-300 bg-base-100 p-6 shadow-sm transition-colors"
  >
    <header class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <span
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
        >
          <ShieldCheckIcon class="h-6 w-6" />
        </span>
        <div>
          <h3 class="font-serif text-base font-semibold text-base-content">
            {{ $t('health_title') }}
          </h3>
          <p class="text-sm text-base-content/60">
            {{ $t('health_desc') }}
          </p>
        </div>
      </div>

      <button
        type="button"
        class="btn btn-primary btn-sm cursor-pointer"
        :disabled="testableRows.length === 0"
        @click="testAll"
      >
        <ArrowPathIcon
          v-if="isTesting"
          class="h-4 w-4 animate-spin"
          aria-hidden="true"
        />
        {{ isTesting ? $t('health_testing') : $t('health_test_all') }}
      </button>
    </header>

    <p
      v-if="testableRows.length === 0"
      class="rounded-lg bg-base-200 px-4 py-3 text-sm text-base-content/60"
    >
      {{ $t('health_empty') }}
    </p>

    <template v-else>
      <ul class="divide-y divide-base-300" aria-live="polite">
        <li
          v-for="row in testableRows"
          :key="row.id"
          class="flex flex-wrap items-center gap-3 py-3"
        >
          <!-- Status icon -->
          <span class="flex h-6 w-6 shrink-0 items-center justify-center">
            <ArrowPathIcon
              v-if="states[row.id] === 'checking'"
              class="h-5 w-5 animate-spin text-base-content/60"
              aria-hidden="true"
            />
            <CheckCircleIcon
              v-else-if="states[row.id] === 'valid'"
              class="h-5 w-5 text-success"
              aria-hidden="true"
            />
            <XCircleIcon
              v-else-if="states[row.id] === 'invalid'"
              class="h-5 w-5 text-error"
              aria-hidden="true"
            />
            <ExclamationTriangleIcon
              v-else-if="states[row.id] === 'error'"
              class="h-5 w-5 text-warning"
              aria-hidden="true"
            />
            <span
              v-else
              class="h-2.5 w-2.5 rounded-full bg-base-content/30"
              aria-hidden="true"
            ></span>
          </span>

          <!-- Label + detail -->
          <div class="min-w-0 flex-1">
            <p class="font-medium text-base-content">{{ row.label }}</p>

            <!-- Expiry / plan line for debrid services -->
            <p
              v-if="states[row.id] === 'valid' && expiryLine(row.id)"
              class="text-xs tabular-nums"
              :class="
                expiryLine(row.id)?.urgent
                  ? 'text-warning'
                  : 'text-base-content/60'
              "
            >
              {{ expiryLine(row.id)?.text }}
            </p>
            <!-- Failure message -->
            <p
              v-else-if="
                states[row.id] === 'invalid' || states[row.id] === 'error'
              "
              class="text-xs break-words"
              :class="
                states[row.id] === 'invalid' ? 'text-error' : 'text-warning'
              "
            >
              {{ results[row.id]?.message }}
            </p>
          </div>

          <!-- Badge + actions stay paired when the row wraps -->
          <div class="flex shrink-0 items-center gap-2">
            <!-- Status badge -->
            <span
              class="badge badge-sm"
              :class="{
                'badge-ghost': !states[row.id] || states[row.id] === 'idle',
                'badge-ghost animate-pulse': states[row.id] === 'checking',
                'badge-success': states[row.id] === 'valid',
                'badge-error': states[row.id] === 'invalid',
                'badge-warning': states[row.id] === 'error'
              }"
            >
              {{ statusLabel(states[row.id]) }}
            </span>

            <!-- Fix button: jump to the field for an invalid/errored key -->
            <button
              v-if="states[row.id] === 'invalid' || states[row.id] === 'error'"
              type="button"
              class="btn btn-ghost btn-xs cursor-pointer"
              :aria-label="$t('health_aria_fix', { service: row.label })"
              @click="emit('focus-field', row.id)"
            >
              {{ $t('health_fix') }}
            </button>

            <!-- Per-row check button -->
            <button
              type="button"
              class="btn btn-ghost btn-xs btn-circle cursor-pointer"
              :disabled="states[row.id] === 'checking'"
              :aria-label="$t('health_check_one', { service: row.label })"
              @click="testOne(row)"
            >
              <ArrowPathIcon
                class="h-4 w-4"
                :class="{ 'animate-spin': states[row.id] === 'checking' }"
                aria-hidden="true"
              />
            </button>
          </div>
        </li>
      </ul>

      <p class="mt-4 text-xs text-base-content/60" aria-live="polite">
        {{
          $t('health_summary', {
            valid: summary.valid,
            invalid: summary.invalid,
            untested: summary.untested
          })
        }}
      </p>
    </template>
  </div>
</template>
