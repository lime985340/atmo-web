<script setup>
import { computed } from 'vue'

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

const pmGrade = computed(() => {
  const raw = Number(props.selectedStation?.air?.grade)
  if (Number.isFinite(raw) && raw >= 1) return raw
  return gradeFromPm(props.selectedStation?.air?.pm25, props.selectedStation?.air?.pm10)
})

const pmGradeLabel = computed(() => {
  if (pmGrade.value === 1) return '좋음'
  if (pmGrade.value === 2) return '보통'
  if (pmGrade.value === 3) return '나쁨'
  if (pmGrade.value === 4) return '매우나쁨'
  return '미측정'
})

const pmGradeClass = computed(() => {
  if (pmGrade.value === 1) return 'badge badge--good'
  if (pmGrade.value === 2) return 'badge badge--ok'
  if (pmGrade.value === 3) return 'badge badge--bad'
  if (pmGrade.value === 4) return 'badge badge--verybad'
  return 'badge badge--unknown'
})

const pmMetricClass = computed(() => {
  if (pmGrade.value === 1) return 'metric metric--good'
  if (pmGrade.value === 2) return 'metric metric--ok'
  if (pmGrade.value === 3) return 'metric metric--bad'
  if (pmGrade.value === 4) return 'metric metric--verybad'
  return 'metric'
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
  <div class="panel__section">
    <h2>환경 상세</h2>
    <div class="card">
      <div class="env__header">
        <div>
          <p class="card__title">{{ props.selectedStation.name }}</p>
          <p class="card__meta">{{ props.selectedStation.addr || '주소 없음' }}</p>
        </div>
        <span :class="pmGradeClass">{{ pmGradeLabel }}</span>
      </div>

      <div class="env__weather">
        <span class="env__weather-icon" aria-hidden="true">{{ weatherIcon }}</span>
        <span class="env__weather-meta">
          습도 {{ props.selectedStation.weather?.humidity ?? '-' }}% · 풍속 {{ props.formatWindSpeed(props.selectedStation.weather?.windSpeed) }}m/s
        </span>
      </div>
      <div class="grid">
        <div>
          <span class="label">미세먼지 (PM10)</span>
          <strong :class="pmMetricClass">{{ props.selectedStation.air?.pm10 ?? '-' }} <span class="grade-label">({{ getPm10Label(props.selectedStation.air?.pm10) }})</span></strong>
        </div>
        <div>
          <span class="label">초미세먼지 (PM2.5)</span>
          <strong :class="pmMetricClass">{{ props.selectedStation.air?.pm25 ?? '-' }} <span class="grade-label">({{ getPm25Label(props.selectedStation.air?.pm25) }})</span></strong>
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
