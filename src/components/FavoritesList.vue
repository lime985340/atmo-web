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
  },
  favoriteCards: {
    type: Array,
    default: () => []
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

const formatTemperature = (value) => {
  if (value === null || value === undefined || value === '') return '-'
  const num = Number(value)
  if (!Number.isFinite(num)) return '-'
  const rounded = Math.round(num * 10) / 10
  if (Number.isInteger(rounded)) return String(rounded)
  return rounded.toFixed(1)
}

const getPm10Label = (value) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return '-'
  if (num <= 30) return '좋음'
  if (num <= 80) return '보통'
  if (num <= 150) return '나쁨'
  return '매우나쁨'
}

const getPm25Label = (value) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return '-'
  if (num <= 15) return '좋음'
  if (num <= 35) return '보통'
  if (num <= 75) return '나쁨'
  return '매우나쁨'
}
</script>

<template>
  <div class="panel__section fav-section">
    <div class="panel__header">
      <h2>즐겨찾기 목록</h2>
      <button class="ghost" type="button" @click="onAdd">+ 추가</button>
    </div>
    <p class="fav__message" v-if="props.message">{{ props.message }}</p>
    <div class="fav-scroll-container">
      <div class="dashboard-cards" v-if="props.favoriteCards.length">
        <div class="dashboard__card" v-for="card in props.favoriteCards" :key="card.id">
          <p class="card__title">{{ card.description }}</p>
          <p class="card__meta" v-if="card.address">{{ card.address }}</p>
          <div class="fav-grid">
            <div>
              <span class="fav-label">온도</span>
              <strong>{{ formatTemperature(card.tempC) }}°C</strong>
            </div>
            <div>
              <span class="fav-label">습도</span>
              <strong>{{ card.humidity ?? '-' }}%</strong>
            </div>
            <div>
              <span class="fav-label">미세먼지</span>
              <strong>{{ card.pm10 ?? '-' }} <span class="grade-label-small">({{ getPm10Label(card.pm10) }})</span></strong>
            </div>
            <div>
              <span class="fav-label">초미세먼지</span>
              <strong>{{ card.pm25 ?? '-' }} <span class="grade-label-small">({{ getPm25Label(card.pm25) }})</span></strong>
            </div>
          </div>
        </div>
      </div>
      <div class="list" v-if="props.favorites.length">
        <div class="list__item" v-for="fav in props.favorites" :key="fav.id" @click="onSelect(fav)">
          <div class="fav__body">
            <p class="list__title">{{ fav.address || fav.description }}</p>
            <p class="list__meta" v-if="fav.description && fav.description !== fav.address">{{ fav.description }}</p>
            <p class="list__meta" v-else-if="!fav.address">주소 정보 없음</p>
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
      <p class="empty" v-if="!props.favorites.length && !props.favoriteCards.length">아직 등록된 즐겨찾기가 없습니다.</p>
    </div>
  </div>
</template>

<style scoped>
.fav-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.fav-scroll-container {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding-right: 4px;
}

.fav-scroll-container::-webkit-scrollbar {
  width: 6px;
}

.fav-scroll-container::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.05);
  border-radius: 3px;
}

.fav-scroll-container::-webkit-scrollbar-thumb {
  background: rgba(15, 23, 42, 0.2);
  border-radius: 3px;
}

.dashboard-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.dashboard__card {
  border-radius: 16px;
  padding: 14px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: linear-gradient(140deg, #ffffff 0%, #f3f7f6 100%);
}

.grade-label-small {
  font-size: 0.7rem;
  color: #5f6f82;
  font-weight: 500;
}

.fav-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-top: 10px;
}

.fav-grid .fav-label {
  display: block;
  font-size: 0.75rem;
  color: #5f6f82;
  margin-bottom: 2px;
}

.fav-grid strong {
  font-size: 0.9rem;
}
</style>
