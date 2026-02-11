<script setup>
const props = defineProps({
  favoriteCards: {
    type: Array,
    default: () => []
  },
  limitedForecast: {
    type: Function,
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
</script>

<template>
  <div class="panel__section">
    <h2>대시보드</h2>
    <div class="dashboard">
      <div class="dashboard__card" v-for="card in props.favoriteCards" :key="card.id">
        <p class="card__title">{{ card.name }}</p>
        <p class="card__meta" v-if="card.stationName">{{ card.stationName }}</p>
        <div class="grid">
          <div>
            <span class="label">온도</span>
            <strong>{{ props.formatTemperature(card.tempC) }}°C</strong>
          </div>
          <div>
            <span class="label">습도</span>
            <strong>{{ card.humidity ?? '-' }}%</strong>
          </div>
          <div>
            <span class="label">미세먼지 (PM10)</span>
            <strong>{{ card.pm10 ?? '-' }}</strong>
          </div>
          <div>
            <span class="label">초미세먼지 (PM2.5)</span>
            <strong>{{ card.pm25 ?? '-' }}</strong>
          </div>
        </div>
        <div class="forecast forecast--compact" v-if="card.forecastHours?.length">
          <h3>예보 (6시간)</h3>
          <div class="forecast__table">
            <div class="forecast__row" v-for="hour in props.limitedForecast(card.forecastHours)" :key="hour.forecastAt">
              <span class="forecast__time">{{ props.formatForecastTime(hour.forecastAt) }}</span>
              <span class="forecast__temp">{{ props.formatTemperature(hour.tempC) }}°C</span>
              <span class="forecast__meta">풍속 {{ props.formatWindSpeed(hour.windSpeed) }}m/s</span>
              <span class="forecast__meta">강수 {{ props.formatPrecipType(hour.precipType) }}</span>
              <span class="forecast__meta">{{ hour.pop ?? '-' }}%</span>
            </div>
          </div>
        </div>
        <p class="stale" v-if="card.stale">데이터 갱신 지연</p>
      </div>
    </div>
  </div>
</template>
