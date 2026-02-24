<script setup>
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: '로그인이 만료되었습니다'
  },
  desc: {
    type: String,
    default: '다시 로그인해 주세요.'
  },
  confirmLabel: {
    type: String,
    default: '확인'
  }
})

const emit = defineEmits(['confirm'])

const onConfirm = () => {
  emit('confirm')
}
</script>

<template>
  <div v-if="props.visible" class="api-logout-dialog" role="dialog" aria-modal="true" aria-live="polite">
    <div class="api-logout-dialog__panel">
      <p class="api-logout-dialog__title">{{ props.title }}</p>
      <p class="api-logout-dialog__desc">{{ props.desc }}</p>
      <button class="api-logout-dialog__confirm" type="button" @click="onConfirm">{{ props.confirmLabel }}</button>
    </div>
  </div>
</template>
