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
      <div class="forecast" v-if="props.forecastHours.length">
        <div class="forecast__header">
          <h3>시간대 예보 ({{ props.forecastRange }}시간)</h3>
          <div class="forecast__range">
            <button
              class="ghost"
              :class="{ active: props.forecastRange === 6 }"
              @click="onSetForecastRange(6)"
            >
              6H
            </button>
            <button
              class="ghost"
              :class="{ active: props.forecastRange === 12 }"
              @click="onSetForecastRange(12)"
            >
              12H
            </button>
            <button
              class="ghost"
              :class="{ active: props.forecastRange === 24 }"
              @click="onSetForecastRange(24)"
            >
              24H
            </button>
          </div>
        </div>
        <div class="forecast__table">
          <div class="forecast__row" v-for="hour in props.forecastHours" :key="hour.forecastAt">
            <span class="forecast__time">{{ props.formatForecastTime(hour.forecastAt) }}</span>
            <span class="forecast__temp">{{ props.formatTemperature(hour.tempC) }}°C</span>
            <span class="forecast__meta">습도 {{ hour.humidity ?? '-' }}%</span>
            <span class="forecast__meta">풍속 {{ hour.windSpeed ?? '-' }}m/s</span>
            <span class="forecast__meta">강수 {{ props.formatPrecipType(hour.precipType) }}</span>
            <span class="forecast__meta">강수량 {{ hour.precipMm ?? '-' }}mm</span>
            <span class="forecast__meta">강수확률 {{ hour.pop ?? '-' }}%</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
