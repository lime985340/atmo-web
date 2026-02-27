<script setup>
const props = defineProps({
  address: {
    type: String,
    default: ''
  },
  name: {
    type: String,
    default: ''
  },
  busy: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:name', 'cancel', 'submit'])

const onInputName = (event) => {
  emit('update:name', event.target.value)
}

const onCancel = () => {
  emit('cancel')
}

const onSubmit = () => {
  emit('submit')
}
</script>

<template>
  <div class="panel__section">
    <div class="card favorite-add">
      <p class="card__title">즐겨찾기 추가</p>
      <p class="card__meta">{{ props.address }}</p>
      <label class="label" for="favoriteAddName">이름</label>
      <input
        id="favoriteAddName"
        class="input"
        :value="props.name"
        type="text"
        autocomplete="off"
        placeholder="예: 우리집, 회사"
        @input="onInputName"
      />
      <div class="favorite-add__actions">
        <button class="ghost" type="button" :disabled="props.busy" @click="onCancel">취소</button>
        <button class="primary" type="button" :disabled="props.busy" @click="onSubmit">+ 추가</button>
      </div>
    </div>
  </div>
</template>
