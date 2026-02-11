<script setup>
const props = defineProps({
  selectedStation: {
    type: Object,
    required: true
  },
  forecastRange: {
    type: Number,
    required: true
  },
  forecastHours: {
    type: Array,
    default: () => []
  },
  forecastAvailability: {
    type: Object,
    default: () => ({})
  },
  forecastRangeOptions: {
    type: Array,
    default: () => [6]
  },
  isAuthenticated: {
    type: Boolean,
    required: true
  },
  formatForecastTime: {
    type: Function,
    required: true
  },
  formatPrecipType: {
    type: Function,
    required: true
  },
  formatTemperature: {
    type: Function,
    required: true
  },
  formatWindSpeed: {
    type: Function,
    required: true
  }
})

const emit = defineEmits(['add-favorite', 'set-forecast-range'])

const onAddFavorite = () => {
  emit('add-favorite')
}

const onSetForecastRange = (hours) => {
  emit('set-forecast-range', hours)
}
</script>

<template>
  <div class="panel__section">
    <h2>측정소 상세</h2>
    <div class="card">
      <p class="card__title">{{ props.selectedStation.name }}</p>
      <p class="card__meta">{{ props.selectedStation.addr || '주소 없음' }}</p>
      <div class="grid">
        <div>
          <span class="label">미세먼지 (PM10)</span>
          <strong>{{ props.selectedStation.air?.pm10 ?? '-' }}</strong>
        </div>
        <div>
          <span class="label">초미세먼지 (PM2.5)</span>
          <strong>{{ props.selectedStation.air?.pm25 ?? '-' }}</strong>
        </div>
        <div>
          <span class="label">온도</span>
          <strong>{{ props.formatTemperature(props.selectedStation.weather?.temp) }}°C</strong>
        </div>
        <div>
          <span class="label">습도</span>
          <strong>{{ props.selectedStation.weather?.humidity ?? '-' }}%</strong>
        </div>
      </div>
      <button class="primary" @click="onAddFavorite" :disabled="!props.isAuthenticated">
        즐겨찾기 추가
      </button>
      <div class="forecast">
        <div class="forecast__header">
          <h3>시간대 예보 ({{ props.forecastRange }}시간)</h3>
          <div class="forecast__range">
            <button
              v-for="hours in props.forecastRangeOptions"
              :key="hours"
              class="ghost"
              :class="{ active: props.forecastRange === hours }"
              :disabled="(props.forecastAvailability[hours] || 0) === 0"
              @click="onSetForecastRange(hours)"
            >
              {{ hours }}H <span class="forecast__count">{{ props.forecastAvailability[hours] || 0 }}</span>
            </button>
          </div>
        </div>
        <div class="forecast__table" v-if="props.forecastHours.length">
          <div class="forecast__row forecast__row--head" aria-hidden="true">
            <span class="forecast__meta">시간</span>
            <span class="forecast__meta">기온</span>
            <span class="forecast__meta">습도</span>
            <span class="forecast__meta">풍속</span>
            <span class="forecast__meta">강수형태</span>
            <span class="forecast__meta">강수량</span>
            <span class="forecast__meta">강수확률</span>
          </div>
          <div class="forecast__row" v-for="hour in props.forecastHours" :key="hour.forecastAt">
            <span class="forecast__time">{{ props.formatForecastTime(hour.forecastAt) }}</span>
            <span class="forecast__temp">{{ props.formatTemperature(hour.tempC) }}°C</span>
            <span class="forecast__meta">{{ hour.humidity ?? '-' }}%</span>
            <span class="forecast__meta">{{ props.formatWindSpeed(hour.windSpeed) }}m/s</span>
            <span class="forecast__meta">{{ props.formatPrecipType(hour.precipType) }}</span>
            <span class="forecast__meta">{{ hour.precipMm ?? '-' }}mm</span>
            <span class="forecast__meta">{{ hour.pop ?? '-' }}%</span>
          </div>
        </div>
        <p class="forecast__empty" v-else>선택한 시간대에 예보 데이터가 없습니다. 다른 시간 범위를 선택해 주세요.</p>
      </div>
    </div>
  </div>
</template>
