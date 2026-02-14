<script setup>
const props = defineProps({
  favorites: {
    type: Array,
    default: () => []
  },
  deletingIds: {
    type: Array,
    default: () => []
  },
  cardsById: {
    type: Object,
    default: () => ({})
  },
  message: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['select', 'remove', 'add'])

const onSelect = (favorite) => {
  emit('select', favorite)
}

const onRemove = (favoriteId) => {
  emit('remove', favoriteId)
}

const onAdd = () => {
  emit('add')
}

const gradeFromPm = (pm25, pm10) => {
  const p25 = Number(pm25)
  const p10 = Number(pm10)
  const g25 = Number.isFinite(p25)
    ? (p25 <= 15 ? 1 : p25 <= 35 ? 2 : p25 <= 75 ? 3 : 4)
    : null
  const g10 = Number.isFinite(p10)
    ? (p10 <= 30 ? 1 : p10 <= 80 ? 2 : p10 <= 150 ? 3 : 4)
    : null
  if (g25 === null && g10 === null) return null
  if (g25 === null) return g10
  if (g10 === null) return g25
  return Math.max(g25, g10)
}

const dotClass = (card) => {
  if (!card) return 'fav__dot fav__dot--unknown'
  const rawGrade = Number(card.grade)
  const grade = Number.isFinite(rawGrade) ? rawGrade : gradeFromPm(card.pm25, card.pm10)
  if (grade === 1) return 'fav__dot fav__dot--good'
  if (grade === 2) return 'fav__dot fav__dot--ok'
  if (grade === 3) return 'fav__dot fav__dot--bad'
  if (grade === 4) return 'fav__dot fav__dot--verybad'
  return 'fav__dot fav__dot--unknown'
}
</script>

<template>
  <div class="panel__section">
    <div class="panel__header">
      <h2>즐겨찾기 목록</h2>
      <button class="ghost" type="button" @click="onAdd">+ 추가</button>
    </div>
    <p class="fav__message" v-if="props.message">{{ props.message }}</p>
    <div class="list" v-if="props.favorites.length">
      <div class="list__item" v-for="fav in props.favorites" :key="fav.id" @click="onSelect(fav)">
        <div class="fav__body">
          <p class="list__title">{{ fav.stationName || fav.name }}</p>
          <p class="list__meta" v-if="fav.name && fav.name !== fav.stationName">{{ fav.name }}</p>
          <p class="list__meta" v-else-if="!fav.stationName">연결 정보 없음</p>
        </div>
        <div class="fav__right">
          <span class="fav__temp">{{ (props.cardsById[fav.id]?.tempC ?? '-') }}°</span>
          <span :class="dotClass(props.cardsById[fav.id])" aria-hidden="true"></span>
        </div>
        <button class="ghost" :disabled="props.deletingIds.includes(fav.id)" @click.stop="onRemove(fav.id)">
          {{ props.deletingIds.includes(fav.id) ? '삭제 중...' : '삭제' }}
        </button>
      </div>
    </div>
    <p class="empty" v-else>아직 등록된 즐겨찾기가 없습니다.</p>
  </div>
</template>
