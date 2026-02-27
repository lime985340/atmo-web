<script setup>
import { computed } from 'vue'
import {
  getAirQualityBadgeClass,
  getAirQualityLabel,
  getPm10Label,
  getPm10MetricClass,
  getPm25Label,
  getPm25MetricClass,
  resolveAirQualityGrade
} from '../utils/airQuality'
import { formatDataTime } from '../utils/formatters'

const props = defineProps({
  selectedStation: {
    type: Object,
    required: true
  },
  favoriteLocation: {
    type: Object,
    default: null
  },
  isLoading: {
    type: Boolean,
    default: false
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

const emit = defineEmits(['set-forecast-range'])

const pmGrade = computed(() => {
  return resolveAirQualityGrade({
    explicitGrade: props.selectedStation?.air?.grade,
    pm10: props.selectedStation?.air?.pm10,
    pm25: props.selectedStation?.air?.pm25
  })
})

const pmGradeLabel = computed(() => {
  return getAirQualityLabel(pmGrade.value)
})

const pmGradeClass = computed(() => {
  return getAirQualityBadgeClass(pmGrade.value)
})

const resolveSkyIcon = (skyRaw) => {
  const value = Number(skyRaw)
  if (value === 1) return '☀️'
  if (value === 3) return '🌤️'
  if (value === 4) return '☁️'
  return '⛅'
}

const resolvePrecipIcon = (precipTypeRaw) => {
  const raw = String(precipTypeRaw || '').toUpperCase()
  if (!raw || raw === 'NONE' || raw === '0') return null
  if (raw.includes('SNOW') || raw === '3') return '❄️'
  if (raw.includes('SLEET') || raw.includes('RAIN/SNOW') || raw === '2') return '🌨️'
  if (raw.includes('SHOWER') || raw === '4') return '🌦️'
  return '🌧️'
}

const weatherIcon = computed(() => {
  const next = Array.isArray(props.forecastHours) ? props.forecastHours[0] : null
  const precipIcon = resolvePrecipIcon(next?.precipType)
  if (precipIcon) return precipIcon
  const precip = Number(props.selectedStation?.weather?.precip)
  if (Number.isFinite(precip) && precip > 0) return '🌧️'
  const humidity = Number(props.selectedStation?.weather?.humidity)
  if (Number.isFinite(humidity) && humidity >= 85) return '🌫️'
  return resolveSkyIcon(next?.sky)
})

const onSetForecastRange = (hours) => {
  emit('set-forecast-range', hours)
}
</script>

<template>
  <div class="panel__section">
    <h2>환경 상세</h2>
    <div class="card">
      <!-- 로딩 상태 표시 -->
      <div v-if="props.isLoading" class="env__loading">
        <span class="env__spinner" aria-hidden="true"></span>
        <p class="env__loading-text">데이터를 불러오는 중...</p>
      </div>
      
      <template v-else>
        <div class="env__header">
          <div>
            <p class="card__title">{{ props.favoriteLocation?.description || props.selectedStation.name }}</p>
            <p class="card__meta">{{ props.favoriteLocation?.address || props.selectedStation.addr || '주소 없음' }}</p>
          </div>
          <div class="env__grade-badge" title="미세먼지 등급">
            <span :class="pmGradeClass">{{ pmGradeLabel }}</span>
          </div>
        </div>

        <div class="env__weather">
          <span class="env__weather-icon" aria-hidden="true">{{ weatherIcon }}</span>
          <span class="env__weather-meta">
            습도 {{ props.selectedStation.weather?.humidity ?? '-' }}% · 풍속 {{ props.formatWindSpeed(props.selectedStation.weather?.windSpeed) }}m/s
          </span>
        </div>
        
        <!-- 측정 시간 표시 -->
        <p class="env__time" v-if="props.selectedStation.air?.dataTime || props.selectedStation.weather?.obsTime">
          측정 시간: {{ formatDataTime(props.selectedStation.air?.dataTime || props.selectedStation.weather?.obsTime) }}
        </p>

        <div class="grid">
          <div>
            <span class="label">미세먼지 (PM10)</span>
            <strong :class="getPm10MetricClass(props.selectedStation.air?.pm10)">{{ props.selectedStation.air?.pm10 ?? '-' }} <span class="grade-label">({{ getPm10Label(props.selectedStation.air?.pm10) }})</span></strong>
          </div>
          <div>
            <span class="label">초미세먼지 (PM2.5)</span>
            <strong :class="getPm25MetricClass(props.selectedStation.air?.pm25)">{{ props.selectedStation.air?.pm25 ?? '-' }} <span class="grade-label">({{ getPm25Label(props.selectedStation.air?.pm25) }})</span></strong>
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
        <div class="forecast">
          <div class="forecast__header">
            <h3>예보</h3>
          </div>
          <div class="forecast__table-wrapper" v-if="props.forecastHours.length">
            <div class="forecast__table">
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
          </div>
          <p class="forecast__empty" v-else>예보 데이터가 없습니다.</p>
        </div>
      </template>
    </div>
  </div>
</template>
