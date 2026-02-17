<script setup>
import { computed } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: ''
  },
  desc: {
    type: String,
    default: ''
  }
})

const renderedTitle = computed(() => props.title || '처리 중입니다')
</script>

<template>
  <div v-if="props.visible" class="auth-modal" role="dialog" aria-modal="true" aria-live="polite">
    <div class="auth-modal__backdrop"></div>
    <div class="auth-modal__panel">
      <span class="auth-modal__spinner" aria-hidden="true"></span>
      <p class="auth-modal__title">{{ renderedTitle }}</p>
      <p v-if="props.desc" class="auth-modal__desc">{{ props.desc }}</p>
      <p class="auth-modal__wait">잠시만 기다려 주세요<span class="auth-modal__dots" aria-hidden="true"></span></p>
    </div>
  </div>
</template>
