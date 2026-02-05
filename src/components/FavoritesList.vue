<script setup>
const props = defineProps({
  favorites: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['remove'])

const onRemove = (favoriteId) => {
  emit('remove', favoriteId)
}
</script>

<template>
  <div class="panel__section">
    <h2>즐겨찾기</h2>
    <div class="list">
      <div class="list__item" v-for="fav in props.favorites" :key="fav.id">
        <div>
          <p class="list__title">{{ fav.name }}</p>
          <p class="list__meta">{{ fav.stationName || '측정소 미연결' }}</p>
        </div>
        <button class="ghost" @click="onRemove(fav.id)">삭제</button>
      </div>
    </div>
  </div>
</template>
