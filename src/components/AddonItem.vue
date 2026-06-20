<script setup>
import {
  ClipboardDocumentIcon,
  PencilSquareIcon,
  TrashIcon
} from '@heroicons/vue/24/outline';

const props = defineProps({
  name: {
    type: String,
    required: true
  },
  idx: {
    type: Number,
    required: true
  },
  manifestURL: {
    type: String,
    required: true
  },
  logoURL: {
    type: String,
    required: false
  },
  isDeletable: {
    type: Boolean,
    required: false,
    default: true
  },
  isConfigurable: {
    type: Boolean,
    required: false,
    default: false
  }
});

const emits = defineEmits(['delete-addon', 'edit-manifest']);

const defaultLogo = 'https://icongr.am/feather/box.svg?size=48&color=ffffff';

function copyManifestURLToClipboard() {
  navigator.clipboard
    .writeText(props.manifestURL)
    .then(() => {
      console.log('Text copied to clipboard');
    })
    .catch((error) => {
      console.error('Error copying text to clipboard', error);
    });
}

function removeAddon() {
  emits('delete-addon', props.idx);
}

function openEditManifestModal() {
  emits('edit-manifest', props.idx);
}
</script>

<template>
  <div
    class="item flex items-center justify-between flex-wrap rounded-lg p-3 mb-3 border border-base-300 bg-base-200 relative cursor-move"
  >
    <div class="col-8 flex-1 min-w-0">
      <div class="details flex items-center min-w-0">
        <div class="logo_container">
          <img
            :src="logoURL || defaultLogo"
            class="h-12 w-12 pointer-events-none mr-3 object-contain object-center rounded-[30%] bg-[#1e1b16]"
          />
        </div>
        <span
          class="text-base font-medium text-base-content truncate min-w-0"
          >{{ name }}</span
        >
      </div>
    </div>
    <div class="col flex gap-2 flex-wrap items-center mt-2 md:mt-0">
      <button
        class="button icon-only copy-url flex justify-center items-center rounded px-2 py-1 transition-colors hover:bg-base-300 cursor-pointer"
        title="Copy addon manifest URL to clipboard"
        aria-label="Copy addon manifest URL to clipboard"
        @click="copyManifestURLToClipboard"
      >
        <ClipboardDocumentIcon class="w-5 h-5" />
      </button>
      <button
        class="button icon-only edit-manifest flex justify-center items-center rounded px-2 py-1 transition-colors hover:bg-base-300 cursor-pointer"
        title="Edit manifest JSON"
        aria-label="Edit manifest JSON"
        @click="openEditManifestModal"
      >
        <PencilSquareIcon class="w-5 h-5" />
      </button>
      <button
        class="button icon-only delete flex justify-center items-center rounded px-2 py-1 transition-colors hover:bg-base-300 disabled:opacity-50 cursor-pointer"
        title="Remove addon from list"
        aria-label="Remove addon from list"
        :disabled="!isDeletable"
        @click="removeAddon"
      >
        <TrashIcon class="w-5 h-5" />
      </button>
    </div>
    <i
      class="uil uil-draggabledots absolute right-2 bottom-2 text-xl text-base-content/40 md:static md:ml-4"
    ></i>
  </div>
</template>
