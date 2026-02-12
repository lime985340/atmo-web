<script setup>
const props = defineProps({
  favorites: {
    type: Array,
    default: () => []
  },
  deletingIds: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['select', 'remove'])

const onSelect = (favorite) => {
  emit('select', favorite)
}

const onRemove = (favoriteId) => {
  emit('remove', favoriteId)
}
</script>

<template>
  <div class="panel__section">
    <h2>즐겨찾기</h2>
    <div class="list">
      <div class="list__item" v-for="fav in props.favorites" :key="fav.id" @click="onSelect(fav)">
        <div>
          <p class="list__title">{{ fav.stationName || fav.name }}</p>
          <p class="list__meta" v-if="fav.name && fav.name !== fav.stationName">{{ fav.name }}</p>
          <p class="list__meta" v-else-if="!fav.stationName">측정소 미연결</p>
        </div>
        <button class="ghost" :disabled="props.deletingIds.includes(fav.id)" @click.stop="onRemove(fav.id)">
          {{ props.deletingIds.includes(fav.id) ? '삭제 중...' : '삭제' }}
        </button>
      </div>
    </div>
  </div>
</template>
