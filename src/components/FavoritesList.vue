<script setup>
import {
  getFavoriteDotClass,
  getPm10Label,
  getPm10MetricClass,
  getPm25Label,
  getPm25MetricClass,
  resolveAirQualityGrade
} from '../utils/airQuality'
import { formatDataTime, formatTemperature } from '../utils/formatters'

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

const onSelect = (card) => {
  emit('select', card)
}

const onRemove = (favoriteId) => {
  emit('remove', favoriteId)
}

const onAdd = () => {
  emit('add')
}

const dotClass = (card) => {
  const grade = resolveAirQualityGrade({
    explicitGrade: card?.grade,
    pm10: card?.pm10,
    pm25: card?.pm25
  })
  return getFavoriteDotClass(grade)
}
</script>

<template>
  <div class="panel__section fav-section">
    <div class="fav-header">
      <h2>즐겨찾기 목록</h2>
      <button class="ghost" type="button" @click="onAdd">+ 추가</button>
    </div>
    <p class="fav__message" v-if="props.message">{{ props.message }}</p>
    <div class="fav-scroll-container">
      <!-- Dashboard 카드를 즐겨찾기 목록으로 사용 -->
      <div class="dashboard-cards" v-if="props.favoriteCards.length">
        <div 
          class="dashboard__card fav-card" 
          v-for="card in props.favoriteCards" 
          :key="card.id"
          @click="onSelect(card)"
        >
          <div class="fav-card__header">
            <div class="fav-card__info">
              <p class="card__title">{{ card.description }}</p>
              <p class="card__meta" v-if="card.address">{{ card.address }}</p>
            </div>
            <div class="fav-card__actions">
              <span :class="dotClass(card)" aria-hidden="true"></span>
              <button 
                class="ghost fav-card__delete" 
                :disabled="props.deletingIds.includes(card.id)" 
                @click.stop="onRemove(card.id)"
              >
                {{ props.deletingIds.includes(card.id) ? '삭제 중...' : '삭제' }}
              </button>
            </div>
          </div>
          <!-- 구분선 -->
          <div class="fav-card__divider"></div>
          
          <!-- 환경 상세와 동일한 순서: 미세→초미세→온도→습도 -->
          <div class="fav-grid">
            <div>
              <span class="fav-label">미세먼지 (PM10)</span>
              <strong :class="getPm10MetricClass(card.pm10)">{{ card.pm10 ?? '-' }} <span class="grade-label-small">({{ getPm10Label(card.pm10) }})</span></strong>
            </div>
            <div>
              <span class="fav-label">초미세먼지 (PM2.5)</span>
              <strong :class="getPm25MetricClass(card.pm25)">{{ card.pm25 ?? '-' }} <span class="grade-label-small">({{ getPm25Label(card.pm25) }})</span></strong>
            </div>
            <div>
              <span class="fav-label">온도</span>
              <strong>{{ formatTemperature(card.tempC) }}°C</strong>
            </div>
            <div>
              <span class="fav-label">습도</span>
              <strong>{{ card.humidity ?? '-' }}%</strong>
            </div>
          </div>
          <!-- 데이터 시간 표시 -->
          <p class="fav-card__time" v-if="card.airDataTime || card.weatherObsTime">
            측정 시간: {{ formatDataTime(card.airDataTime || card.weatherObsTime) }}
            <span v-if="card.stale" class="fav-card__stale">(지연)</span>
          </p>
        </div>
      </div>
      <p class="empty" v-else>아직 등록된 즐겨찾기가 없습니다.</p>
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

/* 환경 상세와 동일한 헤더 스타일 */
.fav-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.fav-header h2 {
  font-size: 0.95rem;
  margin: 0;
  color: var(--ink);
  text-transform: uppercase;
  letter-spacing: 0.08em;
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
}

.dashboard__card {
  border-radius: 16px;
  padding: 14px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: linear-gradient(140deg, #ffffff 0%, #f3f7f6 100%);
}

/* 클릭 가능한 카드 스타일 */
.fav-card {
  cursor: pointer;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}

.fav-card:hover {
  border-color: #7ea6d4;
  box-shadow: 0 6px 14px rgba(31, 58, 95, 0.08);
}

.fav-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 10px;
}

.fav-card__info {
  flex: 1;
  min-width: 0;
}

.fav-card__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.fav-card__delete {
  font-size: 0.75rem;
  padding: 4px 8px;
}

.fav-card__time {
  margin: 10px 0 0 0;
  font-size: 0.75rem;
  color: var(--muted);
}

.fav-card__stale {
  color: #e05d3c;
  font-weight: 600;
}

/* 구분선 */
.fav-card__divider {
  height: 1px;
  background: rgba(15, 23, 42, 0.1);
  margin: 12px 0;
}

/* metric 클래스 - 환경 상세와 동일 */
.metric {
  font-variant-numeric: tabular-nums;
}

.metric--good {
  color: #16a34a;
}

.metric--ok {
  color: #2563eb;
}

.metric--bad {
  color: #dc2626;
}

.metric--verybad {
  color: #7f1d1d;
}

.grade-label-small {
  font-size: 0.7rem;
  color: inherit;
  opacity: 0.85;
  font-weight: 500;
}

.fav-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
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

/* dot 클래스 스타일 */
.fav__dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  border: 1px solid rgba(15, 23, 42, 0.16);
}

.fav__dot--good {
  background: #16a34a;
}

.fav__dot--ok {
  background: #2563eb;
}

.fav__dot--bad {
  background: #dc2626;
}

.fav__dot--verybad {
  background: #7f1d1d;
}

.fav__dot--unknown {
  background: #94a3b8;
}
</style>
