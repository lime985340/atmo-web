<script setup>
import { computed, onMounted, ref } from 'vue'
import TopBar from './components/TopBar.vue'
import StationDetail from './components/StationDetail.vue'
import FavoritesList from './components/FavoritesList.vue'
import DashboardPanel from './components/DashboardPanel.vue'

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1'
const KAKAO_KEY = import.meta.env.VITE_KAKAO_APP_KEY || ''

const mapEl = ref(null)
const map = ref(null)
const stationMarkers = ref([])
const polygonOverlays = ref([])
const polygonCache = new Map()
const lastPolygonKey = ref('')

const loading = ref(false)
const user = ref(null)
const authLoading = ref(true)
const accessToken = ref(localStorage.getItem('accessToken') || '')

const showPolygons = ref(false)
const showStations = ref(true)

const stations = ref([])
const selectedStation = ref(null)
const forecastHours = ref([])
const forecastRange = ref(12)
const favoriteForecastRange = 6
const favorites = ref([])
const favoriteCards = ref([])
const statusMessage = ref('')

const isAuthenticated = computed(() => Boolean(accessToken.value))

const providers = [
  { key: 'kakao', label: '카카오', theme: 'kakao' },
  { key: 'google', label: '구글', theme: 'google' },
  { key: 'naver', label: '네이버', theme: 'naver' }
]

const authHeader = computed(() =>
  accessToken.value ? { Authorization: `Bearer ${accessToken.value}` } : {}
)

const providerDisplayMap = {
  kakao: '카카오',
  google: '구글',
  naver: '네이버'
}

const normalizeUser = (raw) => {
  if (!raw || raw.authenticated !== true) return null
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  const email = typeof raw.email === 'string' ? raw.email.trim() : ''
  const provider = typeof raw.provider === 'string' ? raw.provider.toLowerCase() : ''
  const providerLabel = providerDisplayMap[provider] || '소셜'
  const emailPrefix = email.includes('@') ? email.split('@')[0] : email
  const displayName = name || emailPrefix || `${providerLabel} 사용자`
  return {
    ...raw,
    provider,
    displayName
  }
}

const apiFetch = async (path, options = {}) => {
  const url = `${API_BASE}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader.value,
      ...(options.headers || {})
    }
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `요청 실패 (${res.status})`)
  }
  return res.json().catch(() => ({}))
}

const login = async (provider) => {
  try {
    const returnTo = `${window.location.origin}${window.location.pathname}`
    const data = await apiFetch(`/auth/oauth/${provider}/authorize-url?returnTo=${encodeURIComponent(returnTo)}`)
    window.location.href = data.authorizeUrl
  } catch (err) {
    const message = err instanceof Error ? err.message : '로그인 요청에 실패했습니다.'
    setStatus(message)
  }
}

const logout = async () => {
  if (!accessToken.value) return
  try {
    await apiFetch('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({})
    })
  } finally {
    accessToken.value = ''
    localStorage.removeItem('accessToken')
    user.value = null
  }
}

const refreshAccessToken = async () => {
  try {
    const data = await apiFetch('/auth/refresh', {
      method: 'POST',
      headers: { 'X-Client': 'web' },
      body: JSON.stringify({})
    })
    if (data.accessToken) {
      accessToken.value = data.accessToken
      localStorage.setItem('accessToken', data.accessToken)
    }
  } catch (err) {
    accessToken.value = ''
    localStorage.removeItem('accessToken')
  }
}

const loadMe = async () => {
  if (!accessToken.value) {
    user.value = null
    return
  }
  try {
    const data = await apiFetch('/me')
    user.value = normalizeUser(data)
  } catch {
    user.value = null
  }
}

const loadFavorites = async () => {
  if (!accessToken.value) return
  favorites.value = await apiFetch('/favorites')
  favoriteCards.value = await apiFetch('/favorites/dashboard')
}

const limitedForecast = (items, limit = favoriteForecastRange) => {
  if (!Array.isArray(items)) return []
  return items.slice(0, limit)
}

const parseForecastTime = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const trimForecastByRange = (items, hours) => {
  if (!Array.isArray(items)) return []
  const nowMs = Date.now()
  const untilMs = nowMs + hours * 60 * 60 * 1000
  return items
    .filter((hour) => {
      const parsed = parseForecastTime(hour?.forecastAt)
      if (!parsed) return true
      return parsed.getTime() <= untilMs
    })
    .sort((a, b) => {
      const ta = parseForecastTime(a?.forecastAt)?.getTime() ?? Number.MAX_SAFE_INTEGER
      const tb = parseForecastTime(b?.forecastAt)?.getTime() ?? Number.MAX_SAFE_INTEGER
      return ta - tb
    })
}

const formatTemperature = (value) => {
  if (value === null || value === undefined || value === '') return '-'
  const num = Number(value)
  if (!Number.isFinite(num)) return '-'
  const rounded = Math.round(num * 10) / 10
  if (Number.isInteger(rounded)) return String(rounded)
  return rounded.toFixed(1)
}

const addFavorite = async () => {
  if (!selectedStation.value) return
  const payload = {
    name: selectedStation.value.name,
    lat: selectedStation.value.lat,
    lng: selectedStation.value.lng
  }
  await apiFetch('/favorites', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
  await loadFavorites()
}

const removeFavorite = async (favoriteId) => {
  await apiFetch(`/favorites/${favoriteId}`, { method: 'DELETE' })
  await loadFavorites()
}

const loadStations = async () => {
  const snapshot = getMapSnapshot()
  if (!snapshot) {
    const data = await apiFetch('/stations')
    stations.value = data.stations || []
    renderStationMarkers(stations.value)
    return
  }
  const { swLat, swLng, neLat, neLng } = snapshot
  const data = await apiFetch(`/stations/bbox?swLat=${swLat}&swLng=${swLng}&neLat=${neLat}&neLng=${neLng}&limit=500`)
  stations.value = data.stations || []
  renderStationMarkers(stations.value)
}

const loadStationDetail = async (stationId) => {
  const resolvedId = Number(stationId)
  if (!Number.isFinite(resolvedId) || resolvedId <= 0) {
    setStatus('측정소 식별자를 확인할 수 없습니다.')
    return
  }
  selectedStation.value = await apiFetch(`/stations/${resolvedId}`)
  const data = await apiFetch(`/stations/${resolvedId}/forecast?hours=${forecastRange.value}`)
  forecastHours.value = trimForecastByRange(data, forecastRange.value)
}

const setForecastRange = async (hours) => {
  forecastRange.value = hours
  if (selectedStation.value?.id) {
    const data = await apiFetch(`/stations/${selectedStation.value.id}/forecast?hours=${hours}`)
    forecastHours.value = trimForecastByRange(data, hours)
  }
}

const setStatus = (msg) => {
  statusMessage.value = msg
  if (msg) {
    setTimeout(() => {
      if (statusMessage.value === msg) statusMessage.value = ''
    }, 4000)
  }
}

const initKakao = () => new Promise((resolve, reject) => {
  if (window.kakao && window.kakao.maps) return resolve()
  if (!KAKAO_KEY) {
    reject(new Error('Kakao API key가 없습니다. VITE_KAKAO_APP_KEY를 설정하세요.'))
    return
  }
  const script = document.createElement('script')
  script.src = `//dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey=${KAKAO_KEY}`
  script.onload = () => window.kakao.maps.load(resolve)
  script.onerror = reject
  document.head.appendChild(script)
})

const clearMarkers = (list) => {
  list.forEach((m) => {
    m.setMap(null)
  })
  list.length = 0
}

const toggleStationMarkers = () => {
  if (!showStations.value) {
    clearMarkers(stationMarkers.value)
    return
  }
  renderStationMarkers(stations.value)
}

const getMapSnapshot = () => {
  if (!map.value) return null
  const bounds = map.value.getBounds()
  const level = map.value.getLevel()
  const sw = bounds.getSouthWest()
  const ne = bounds.getNorthEast()
  return {
    level,
    swLat: sw.getLat(),
    swLng: sw.getLng(),
    neLat: ne.getLat(),
    neLng: ne.getLng()
  }
}

const renderStationMarkers = (items) => {
  clearMarkers(stationMarkers.value)
  if (!showStations.value || !Array.isArray(items) || items.length === 0) return
  stationMarkers.value.push(
    ...items
      .filter((item) => item?.lat != null && item?.lng != null)
      .map((item) => {
    const stationId = item.id ?? item.stationId
    const marker = new window.kakao.maps.Marker({
      map: map.value,
      position: new window.kakao.maps.LatLng(item.lat, item.lng)
    })
    window.kakao.maps.event.addListener(marker, 'click', () => {
      loadStationDetail(stationId)
    })
    return marker
  })
  )
}

const clearPolygons = () => {
  polygonOverlays.value.forEach((p) => {
    p.setMap(null)
  })
  polygonOverlays.value = []
}

const getPolygonLevel = (level) => {
  if (level <= 5) return 'emd'
  if (level <= 7) return 'sigungu'
  return 'sido'
}

const resolveRegionCode = () => {
  if (selectedStation.value?.regionCode) return selectedStation.value.regionCode
  const stationWithCode = stations.value.find((s) => s.regionCode)
  return stationWithCode?.regionCode || ''
}

const loadPolygons = async () => {
  const snapshot = getMapSnapshot()
  if (!snapshot) return
  if (!showPolygons.value) {
    clearPolygons()
    lastPolygonKey.value = ''
    return
  }

  try {
    const level = getPolygonLevel(snapshot.level)
    const regionCode = resolveRegionCode()
    let endpoint = '/map/polygons/sido'
    let key = 'sido'
    if (level === 'sigungu' && regionCode) {
      endpoint = `/map/polygons/sigungu/${regionCode}`
      key = `sigungu:${regionCode}`
    }
    if (level === 'emd' && regionCode) {
      endpoint = `/map/polygons/emd/${regionCode}`
      key = `emd:${regionCode}`
    }
    if (key === lastPolygonKey.value) return

    let geojson = polygonCache.get(key)
    if (!geojson) {
      geojson = await apiFetch(endpoint)
      polygonCache.set(key, geojson)
    }
    lastPolygonKey.value = key

    clearPolygons()
    geojson.features.forEach((feature) => {
      const coords = feature.geometry.coordinates[0]
      const path = coords.map((c) => new window.kakao.maps.LatLng(c[1], c[0]))
      const polygon = new window.kakao.maps.Polygon({
        path,
        strokeWeight: 2,
        strokeColor: '#1F3A5F',
        strokeOpacity: 0.8,
        fillColor: '#BBD5ED',
        fillOpacity: 0.18
      })
      polygon.setMap(map.value)
      polygonOverlays.value.push(polygon)
    })
  } catch (err) {
    setStatus(err.message)
  }
}

const initialize = async () => {
  try {
    await initKakao()
    map.value = new window.kakao.maps.Map(mapEl.value, {
      center: new window.kakao.maps.LatLng(37.5665, 126.978),
      level: 7
    })
    window.kakao.maps.event.addListener(map.value, 'idle', () => {
      loadStations()
      if (showPolygons.value) {
        loadPolygons()
      }
    })
    await loadStations()
    await loadPolygons()
  } catch (err) {
    setStatus(err.message)
  }
}

const formatForecastTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

const formatPrecipType = (value) => {
  if (!value || value === 'NONE' || value === '0') return '없음'
  const map = {
    1: '비',
    2: '비/눈',
    3: '눈',
    4: '소나기'
  }
  return map[value] || value
}

onMounted(async () => {
  authLoading.value = true
  if (window.location.hash.includes('access_token=')) {
    const hash = new URLSearchParams(window.location.hash.replace('#', ''))
    const token = hash.get('access_token')
    if (token) {
      accessToken.value = token
      localStorage.setItem('accessToken', token)
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }
  try {
    if (accessToken.value) {
      await refreshAccessToken()
      await loadMe()
      await loadFavorites()
    } else {
      user.value = null
    }
  } finally {
    authLoading.value = false
  }
  await initialize()
})
</script>

<template>
  <div class="app">
    <TopBar :user="user" :providers="providers" :auth-loading="authLoading" @login="login" @logout="logout" />

    <main class="layout">
      <section class="panel">
        <div class="panel__section panel__hero">
          <div class="hero__eyebrow">ATMO LIVE</div>
          <h1 class="hero__title">도시의 공기와 날씨를 한눈에</h1>
          <p class="hero__desc">
            지도 바운드 기반 측정소 조회와 줌 레벨별 폴리곤을 결합해 지금 이 순간의 환경 흐름을 보여줍니다.
          </p>
          <div class="hero__stats">
            <div class="stat">
              <span class="stat__label">현재 측정소</span>
              <strong class="stat__value">{{ stations.length }}</strong>
            </div>
            <div class="stat">
              <span class="stat__label">즐겨찾기</span>
              <strong class="stat__value">{{ favorites.length }}</strong>
            </div>
            <div class="stat">
              <span class="stat__label">선택 측정소</span>
              <strong class="stat__value">{{ selectedStation?.name || '-' }}</strong>
            </div>
          </div>
        </div>

        <div class="panel__section">
          <h2>지도 레이어</h2>
          <label class="toggle">
            <input type="checkbox" v-model="showStations" @change="toggleStationMarkers" />
            <span>측정소 마커</span>
          </label>
          <label class="toggle">
            <input type="checkbox" v-model="showPolygons" @change="loadPolygons" />
            <span>지역 폴리곤</span>
          </label>
        </div>

        <StationDetail
          v-if="selectedStation"
          :selected-station="selectedStation"
          :forecast-range="forecastRange"
          :forecast-hours="forecastHours"
          :is-authenticated="isAuthenticated"
          :format-forecast-time="formatForecastTime"
          :format-precip-type="formatPrecipType"
          :format-temperature="formatTemperature"
          @add-favorite="addFavorite"
          @set-forecast-range="setForecastRange"
        />

        <FavoritesList v-if="favorites.length" :favorites="favorites" @remove="removeFavorite" />

        <DashboardPanel
          v-if="favoriteCards.length"
          :favorite-cards="favoriteCards"
          :limited-forecast="limitedForecast"
          :format-forecast-time="formatForecastTime"
          :format-precip-type="formatPrecipType"
          :format-temperature="formatTemperature"
        />
      </section>

      <section class="map">
        <div class="map__canvas" ref="mapEl"></div>
        <div class="map__status" v-if="loading">지도 데이터를 불러오는 중...</div>
        <div class="map__status error" v-if="statusMessage">{{ statusMessage }}</div>
      </section>
    </main>
  </div>
</template>
