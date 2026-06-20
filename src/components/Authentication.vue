<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { loginUser, createUser } from '../api/platformApi';
import {
  QuestionMarkCircleIcon,
  UserCircleIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/vue/24/outline';
import HowGetAuthKey from './HowGetAuthKey.vue';
import { addNotification } from '../composables/useNotifications';

const { t } = useI18n();

const props = defineProps({
  platform: {
    type: String,
    default: 'stremio'
  }
});

const authKey = ref('');
const email = ref('');
const password = ref('');
const loggedIn = ref(false);
const isLoggingIn = ref(false);
const isRegistering = ref(false);
const showAuthKey = ref(false);
const selectedPlatform = ref(props.platform);
const emits = defineEmits(['auth-key', 'platform-change']);

const platformLabel = computed(() =>
  selectedPlatform.value === 'nuvio' ? 'Nuvio' : 'Stremio'
);

watch(
  () => props.platform,
  (nextPlatform) => {
    selectedPlatform.value = nextPlatform || 'stremio';
  }
);

watch(selectedPlatform, (nextPlatform) => {
  loggedIn.value = false;
  authKey.value = '';
  emits('platform-change', nextPlatform);
  emitAuthKey('reset');
});

function loginUserPassword() {
  if (isLoggingIn.value) return;
  isLoggingIn.value = true;
  loginUser(selectedPlatform.value, email.value, password.value)
    .then((data) => {
      if (data?.result?.authKey) {
        authKey.value = data.result.authKey;
        loggedIn.value = true;
        emitAuthKey('login');
      } else {
        addNotification(data?.error?.message || t('login_failed'), 'error');
      }
    })
    .catch((err) => {
      console.error(err);
      addNotification(err?.message || t('login_failed'), 'error');
    })
    .finally(() => {
      isLoggingIn.value = false;
    });
}

function createAccount() {
  if (isRegistering.value) return;
  isRegistering.value = true;
  createUser(selectedPlatform.value, email.value, password.value)
    .then((data) => {
      if (data?.result?.authKey) {
        authKey.value = data.result.authKey;
        loggedIn.value = true;
        emitAuthKey('login');
        addNotification(t('register_successful'), 'success');
      } else {
        addNotification(data?.error?.message || t('register_failed'), 'error');
      }
    })
    .catch((err) => {
      console.error(err);
      addNotification(err?.message || t('register_failed'), 'error');
    })
    .finally(() => {
      isRegistering.value = false;
    });
}

function emitAuthKey(source = 'manual') {
  emits('auth-key', {
    platform: selectedPlatform.value,
    key: authKey.value.replaceAll('"', '').trim(),
    source
  });
}
</script>

<template>
  <section
    id="phase-connect"
    class="scroll-mt-24 lg:scroll-mt-8 max-w-4xl mx-auto px-4 py-8"
  >
    <header class="mb-6 flex items-center gap-3">
      <span
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
      >
        <UserCircleIcon class="h-6 w-6" />
      </span>
      <div>
        <h2 class="font-serif text-2xl font-bold text-base-content">
          {{ $t('phase_connect') }}
        </h2>
        <p class="text-sm text-base-content/60">
          {{ $t('phase_connect_desc') }}
        </p>
      </div>
    </header>

    <div class="rounded-xl border border-base-300 bg-base-100 p-6 shadow-sm">
      <div class="space-y-4">
        <div class="form-control">
          <div class="join w-full">
            <button
              type="button"
              class="btn join-item flex-1"
              :class="
                selectedPlatform === 'stremio' ? 'btn-primary' : 'btn-outline'
              "
              @click="selectedPlatform = 'stremio'"
            >
              Stremio
            </button>
            <button
              type="button"
              class="btn join-item flex-1"
              :class="
                selectedPlatform === 'nuvio' ? 'btn-primary' : 'btn-outline'
              "
              @click="selectedPlatform = 'nuvio'"
            >
              Nuvio
            </button>
          </div>
        </div>

        <div class="form-control">
          <label class="label" for="auth-email">
            <span class="label-text">{{
              $t('label_email', { platform: platformLabel })
            }}</span>
          </label>
          <input
            id="auth-email"
            type="text"
            v-model="email"
            :placeholder="$t('stremio_email', { platform: platformLabel })"
            class="input input-bordered w-full"
          />
        </div>

        <div class="form-control">
          <label class="label" for="auth-password">
            <span class="label-text">{{
              $t('label_password', { platform: platformLabel })
            }}</span>
          </label>
          <input
            id="auth-password"
            type="password"
            v-model="password"
            :placeholder="$t('stremio_password', { platform: platformLabel })"
            class="input input-bordered w-full"
          />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            class="btn btn-primary"
            @click="loginUserPassword"
            :disabled="!email || !password || isLoggingIn"
          >
            <span
              v-if="isLoggingIn"
              class="loading loading-spinner"
              aria-hidden="true"
            ></span>
            {{ loggedIn ? $t('logged_in') : $t('login') }}
          </button>

          <button
            class="btn btn-secondary"
            @click="createAccount"
            :disabled="!email || !password || isRegistering"
          >
            <span
              v-if="isRegistering"
              class="loading loading-spinner"
              aria-hidden="true"
            ></span>
            {{ $t('signup') }}
          </button>
        </div>

        <div v-if="selectedPlatform === 'stremio'" class="divider">
          <strong>{{ $t('or') }}</strong>
        </div>

        <div v-if="selectedPlatform === 'stremio'" class="form-control">
          <label class="label" for="auth-key">
            <span class="label-text">{{
              $t('label_authkey', { platform: platformLabel })
            }}</span>
            <button
              v-if="selectedPlatform === 'stremio'"
              type="button"
              onclick="get_auth_key.showModal()"
              class="p-0 bg-transparent border-0 shadow-none hover:bg-transparent cursor-pointer"
            >
              <QuestionMarkCircleIcon class="h-5 w-5 text-primary" />
            </button>
          </label>
          <div class="relative">
            <input
              id="auth-key"
              :type="showAuthKey ? 'text' : 'password'"
              v-model="authKey"
              v-on:input="emitAuthKey('manual')"
              :placeholder="$t('paste_authkey', { platform: platformLabel })"
              class="input input-bordered w-full pr-12"
            />
            <button
              type="button"
              class="absolute inset-y-0 right-0 flex items-center px-3 text-base-content/60 hover:text-base-content cursor-pointer"
              :aria-label="
                showAuthKey ? $t('aria_hide_value') : $t('aria_show_value')
              "
              @click="showAuthKey = !showAuthKey"
            >
              <EyeSlashIcon
                v-if="showAuthKey"
                class="h-5 w-5"
                aria-hidden="true"
              />
              <EyeIcon v-else class="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
    <HowGetAuthKey v-if="selectedPlatform === 'stremio'" />
  </section>
</template>
