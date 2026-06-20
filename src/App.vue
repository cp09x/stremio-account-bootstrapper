<script setup>
import { useI18n } from 'vue-i18n';
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';
import Header from './components/Header.vue';
import DarkModeToggle from './components/DarkModeToggle.vue';
import LanguageSelector from './components/LanguageSelector.vue';
import Summary from './components/Summary.vue';
import Configuration from './components/Configuration.vue';
import FAQ from './components/FAQ.vue';
import ThankYou from './components/ThankYou.vue';
import Footer from './components/Footer.vue';
import Authentication from './components/Authentication.vue';
import Backup from './components/Backup.vue';
import Notifications from './components/Notifications.vue';
import {
  UserCircleIcon,
  Squares2X2Icon,
  AdjustmentsHorizontalIcon,
  ListBulletIcon,
  CheckIcon,
  ArrowDownIcon,
  ChevronRightIcon
} from '@heroicons/vue/24/outline';

const { t } = useI18n();

const selectedPlatform = ref('stremio');
const authKeysByPlatform = ref({
  stremio: '',
  nuvio: ''
});

const authSourceByPlatform = ref({
  stremio: '',
  nuvio: ''
});

const restoredAccountSnapshot = ref(null);
const importedBuilderSettings = ref(null);

const activeAuthKey = computed(
  () => authKeysByPlatform.value[selectedPlatform.value] || ''
);

const activeAuthSource = computed(
  () => authSourceByPlatform.value[selectedPlatform.value] || ''
);

function setPlatform(platform) {
  selectedPlatform.value = platform;
}

function setAuthKey(payload) {
  if (!payload || !payload.platform) {
    return;
  }

  authKeysByPlatform.value[payload.platform] = payload.key || '';
  authSourceByPlatform.value[payload.platform] = payload.source || '';
}

function setRestoredAccountSnapshot(payload) {
  restoredAccountSnapshot.value = payload;
}

function setImportedBuilderSettings(payload) {
  importedBuilderSettings.value = payload;
}

// --- Presentational-only: 4-phase progress + scroll-spy navigation ---
const appVersion = __APP_VERSION__;

const phases = [
  { id: 'phase-connect', label: 'phase_connect', icon: UserCircleIcon },
  { id: 'phase-choose', label: 'phase_choose', icon: Squares2X2Icon },
  {
    id: 'phase-customize',
    label: 'phase_customize',
    icon: AdjustmentsHorizontalIcon
  },
  { id: 'phase-review', label: 'phase_review', icon: ListBulletIcon }
];

const activePhaseId = ref(phases[0].id);

const activePhaseIndex = computed(() =>
  phases.findIndex((phase) => phase.id === activePhaseId.value)
);

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function scrollToPhase(id) {
  const el = document.getElementById(id);
  if (!el) return;
  activePhaseId.value = id;
  el.scrollIntoView({
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    block: 'start'
  });
  // Move focus to the destination so keyboard/SR users land on the section
  // (also makes the skip-link actually move focus, not just scroll). The phase
  // sections are non-interactive, so make them programmatically focusable.
  if (!el.hasAttribute('tabindex')) {
    el.setAttribute('tabindex', '-1');
  }
  el.focus({ preventScroll: true });
}

let observer = null;

onMounted(() => {
  const sections = phases
    .map((phase) => document.getElementById(phase.id))
    .filter(Boolean);

  if (!('IntersectionObserver' in window) || sections.length === 0) {
    return;
  }

  observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (visible.length > 0) {
        activePhaseId.value = visible[0].target.id;
      }
    },
    {
      // Highlight the section whose heading sits near the top third of the viewport.
      rootMargin: '-20% 0px -60% 0px',
      threshold: [0, 0.1, 0.25, 0.5]
    }
  );

  sections.forEach((section) => observer.observe(section));
});

onBeforeUnmount(() => {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
});
</script>

<template>
  <a
    href="#phase-connect"
    class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-base-100 focus:px-4 focus:py-2 focus:shadow"
  >
    {{ $t('skip_to_content') }}
  </a>

  <!-- Slim top bar -->
  <div
    class="sticky top-0 z-40 border-b border-base-300 bg-base-100/90 backdrop-blur"
  >
    <div
      class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3"
    >
      <a
        href="#phase-connect"
        class="flex items-center gap-2"
        @click.prevent="scrollToPhase('phase-connect')"
      >
        <img src="/logo.png" alt="" class="h-8 w-8" />
        <span class="font-serif text-lg font-bold text-base-content">
          Stremio Account Bootstrapper
        </span>
      </a>
      <div class="flex items-center gap-1">
        <LanguageSelector />
        <DarkModeToggle />
        <a
          href="https://github.com/DryKillLogic/stremio-account-bootstrapper/blob/main/CHANGELOG.md"
          target="_blank"
          rel="noreferrer noopener"
          class="badge badge-outline badge-sm gap-1 transition-colors hover:badge-primary"
          title="View Changelog"
        >
          v{{ appVersion }}
        </a>
      </div>
    </div>

    <!-- Mobile stepper (sticky under the top bar) -->
    <nav
      class="border-t border-base-300 lg:hidden"
      :aria-label="$t('progress_label')"
    >
      <ol class="mx-auto flex max-w-6xl items-center gap-1 px-2 py-2">
        <li
          v-for="(phase, index) in phases"
          :key="phase.id"
          class="flex flex-1 items-center"
        >
          <button
            type="button"
            class="flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors"
            :class="
              activePhaseId === phase.id
                ? 'bg-primary/10 text-primary'
                : 'text-base-content/70 hover:text-base-content'
            "
            :aria-current="activePhaseId === phase.id ? 'step' : undefined"
            @click="scrollToPhase(phase.id)"
          >
            <span
              class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[0.65rem]"
              :class="
                index < activePhaseIndex
                  ? 'border-primary bg-primary text-primary-content'
                  : activePhaseId === phase.id
                    ? 'border-primary text-primary'
                    : 'border-base-300'
              "
            >
              <CheckIcon v-if="index < activePhaseIndex" class="h-3 w-3" />
              <template v-else>{{ index + 1 }}</template>
            </span>
            <span
              class="truncate sm:inline"
              :class="activePhaseId === phase.id ? 'inline' : 'hidden'"
            >
              {{ $t(phase.label) }}
            </span>
          </button>
        </li>
      </ol>
    </nav>
  </div>

  <header>
    <Header
      addonName="Stremio Account Bootstrapper"
      :addonSummary="
        t('addon_summary', {
          platform: selectedPlatform === 'nuvio' ? 'Nuvio' : 'Stremio'
        })
      "
      addonLogo="logo.png"
    />
  </header>

  <Notifications />

  <!-- Main layout: left rail (>=lg) + content -->
  <div class="mx-auto flex max-w-6xl gap-8 px-0 lg:px-4">
    <!-- Left rail progress (desktop) -->
    <aside class="hidden w-56 shrink-0 lg:block">
      <nav class="sticky top-24 py-8" :aria-label="$t('progress_label')">
        <p
          class="mb-4 px-2 text-xs font-semibold uppercase tracking-wide text-base-content/70"
        >
          {{ $t('progress_label') }}
        </p>
        <ol class="space-y-1">
          <li v-for="(phase, index) in phases" :key="phase.id">
            <button
              type="button"
              class="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors"
              :class="
                activePhaseId === phase.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-base-content/70 hover:bg-base-200 hover:text-base-content'
              "
              :aria-current="activePhaseId === phase.id ? 'step' : undefined"
              @click="scrollToPhase(phase.id)"
            >
              <span
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs"
                :class="
                  index < activePhaseIndex
                    ? 'border-primary bg-primary text-primary-content'
                    : activePhaseId === phase.id
                      ? 'border-primary text-primary'
                      : 'border-base-300 text-base-content/70'
                "
              >
                <CheckIcon v-if="index < activePhaseIndex" class="h-4 w-4" />
                <component :is="phase.icon" v-else class="h-4 w-4" />
              </span>
              <span>{{ $t(phase.label) }}</span>
            </button>
          </li>
        </ol>
      </nav>
    </aside>

    <!-- Phase sections + supporting content. Always rendered (no show/hide gating). -->
    <main class="min-w-0 flex-1 pb-28">
      <Summary :platform="selectedPlatform" />
      <Authentication
        :platform="selectedPlatform"
        @platform-change="setPlatform"
        @auth-key="setAuthKey"
      />
      <Configuration
        :platform="selectedPlatform"
        :authKey="activeAuthKey"
        :authSource="activeAuthSource"
        :restoredAccountSnapshot="restoredAccountSnapshot"
        :importedBuilderSettings="importedBuilderSettings"
      />
      <Backup
        :platform="selectedPlatform"
        :authKey="activeAuthKey"
        @restored="setRestoredAccountSnapshot"
        @builder-settings="setImportedBuilderSettings"
      />
      <FAQ :platform="selectedPlatform" />
      <ThankYou />
    </main>
  </div>

  <!-- Sticky bottom action bar -->
  <div
    class="fixed inset-x-0 bottom-0 z-40 border-t border-base-300 bg-base-100/95 backdrop-blur"
  >
    <div
      class="mx-auto flex max-w-6xl flex-col items-stretch gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p class="text-sm text-base-content/70">
        <template v-if="!activeAuthKey">
          {{ $t('action_bar_need_auth') }}
        </template>
        <template v-else>
          {{ $t('action_bar_ready_to_load') }}
        </template>
      </p>
      <!--
        These buttons only scroll (navigation), they do NOT sync/load. The
        real Sync/Load actions live inside the phases (Configuration.vue), so
        these are styled as navigation (ghost/outline) and labeled with the
        destination phase + a directional icon to avoid looking like the
        primary destructive action.
      -->
      <div class="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          class="btn btn-ghost btn-sm sm:btn-md"
          @click="scrollToPhase('phase-customize')"
        >
          {{ $t('phase_customize') }}
          <ChevronRightIcon class="h-4 w-4" />
        </button>
        <button
          type="button"
          class="btn btn-outline btn-sm sm:btn-md"
          @click="scrollToPhase('phase-review')"
        >
          {{ $t('phase_review') }}
          <ArrowDownIcon class="h-4 w-4" />
        </button>
      </div>
    </div>
  </div>

  <!--
    The action bar is fixed at the bottom and is tallest at narrow widths,
    where the status text + two buttons stack vertically. Reserve enough
    bottom padding so the footer's last row never sits under the bar at 375px,
    then shrink it once the bar collapses to a single row at sm/lg.
  -->
  <footer class="pb-44 sm:pb-28 lg:pb-24">
    <Footer />
  </footer>
</template>

<style>
/*
 * Sticky-offset for in-page anchor/scrollToPhase navigation. Set on the
 * scrolling root so phase headings clear the sticky chrome instead of landing
 * under it. Below lg the sticky chrome is the top bar (~56px) + the mobile
 * stepper (~44px) ≈ 100px, so reserve 104px. At lg+ the stepper is hidden
 * (only the top bar remains), matching the sections' lg:scroll-mt-8 (32px).
 * This overrides the per-section scroll-mt-24 (96px) that was too small.
 */
html {
  scroll-padding-top: 104px;
}

@media (min-width: 1024px) {
  html {
    scroll-padding-top: 2rem;
  }
}
</style>
