<script setup>
import { computed, onMounted, ref } from 'vue'
import TopBar from './components/TopBar.vue'
import StationDetail from './components/StationDetail.vue'
import FavoritesList from './components/FavoritesList.vue'
import DashboardPanel from './components/DashboardPanel.vue'

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1'
const KAKAO_KEY = import.meta.env.VITE_KAKAO_APP_KEY || ''
const FORECAST_API_HORIZON_HOURS = 6

const mapEl = ref(null)
const map = ref(null)
const stationMarkers = ref([])
const polygonOverlays = ref([])
const polygonCache = new Map()
const lastPolygonKey = ref('')

const loading = ref(false)
const user = ref(null)
const authLoading = ref(true)
const authModalVisible = ref(false)
const accessToken = ref(localStorage.getItem('accessToken') || '')
const deletingFavoriteIds = ref([])

const stations = ref([])
const stationsRequestSeq = ref(0)
const selectedStation = ref(null)
const selectedFavoriteLocation = ref(null)
const forecastHours = ref([])
const allForecastHours = ref([])
const forecastRange = ref(FORECAST_API_HORIZON_HOURS)
const favoriteForecastRange = 6
const favorites = ref([])
const favoriteCards = ref([])
const statusMessage = ref('')
const favoritesMessage = ref('')
const globalMessage = ref('')
const favoritesRequestSeq = ref(0)

const favoriteCardsById = computed(() => {
  const map = {}
  favoriteCards.value.forEach((card) => {
    const id = Number(card?.id)
    if (!Number.isFinite(id)) return
    map[id] = card
  })
  return map
})

const favoriteAddOpen = ref(false)
const favoriteAddBusy = ref(false)
const favoriteAddAddress = ref('')
const favoriteAddName = ref('')
const favoriteAddCoords = ref(null)

const isAuthenticated = computed(() => Boolean(accessToken.value))

const getJwtExpSeconds = (token) => {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(parts[1].length / 4) * 4, '='))
    const payload = JSON.parse(json)
    return typeof payload.exp === 'number' ? payload.exp : null
  } catch {
    return null
  }
}

const isJwtExpiredOrNearExpiry = (token, skewSeconds = 30) => {
  const exp = getJwtExpSeconds(token)
  if (!exp) return false
  const now = Math.floor(Date.now() / 1000)
  return exp <= now + skewSeconds
}

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

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const genericNameTokens = ['계정', '연동', 'google', 'kakao', 'naver', '구글', '카카오', '네이버']

const isOpaqueName = (value) => {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (!trimmed) return false
  if (uuidPattern.test(trimmed)) return true
  return /^[0-9]{10,}$/.test(trimmed)
}

const isProviderPlaceholderName = (name, providerLabel) => {
  if (!name) return false
  const normalized = name.toLowerCase().replace(/\s+/g, '')
  const providerToken = (providerLabel || '').toLowerCase().replace(/\s+/g, '')
  if (providerToken && normalized === providerToken) return true
  return genericNameTokens.some((token) => normalized.includes(token))
}

const shortUserId = (value) => {
  if (typeof value !== 'string') return ''
  const normalized = value.trim().replace(/[^a-zA-Z0-9]/g, '')
  if (!normalized) return ''
  return normalized.slice(0, 8)
}

const normalizeUser = (raw) => {
  if (!raw || raw.authenticated !== true) return null
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  const safeName = isOpaqueName(name) ? '' : name
  const email = typeof raw.email === 'string' ? raw.email.trim() : ''
  const provider = typeof raw.provider === 'string' ? raw.provider.toLowerCase() : ''
  const providerLabel = providerDisplayMap[provider] || '소셜'
  const emailPrefix = email.includes('@') ? email.split('@')[0] : ''
  const idLabel = shortUserId(typeof raw.id === 'string' ? raw.id : '')
  const friendlyName = isProviderPlaceholderName(safeName, providerLabel) ? '' : safeName
  const displayName = friendlyName || emailPrefix || (idLabel ? `ID ${idLabel}` : '사용자')
  const displayNameUi = friendlyName ? `${friendlyName}님` : displayName
  const identityLabel = friendlyName ? '이름' : (idLabel ? '계정 ID' : '계정')
  const accountLabel = friendlyName || (idLabel ? `ID ${idLabel}` : providerLabel)
  return {
    ...raw,
    provider,
    providerLabel,
    displayName,
    displayNameUi,
    identityLabel,
    accountLabel
  }
}

const apiFetch = async (path, options = {}, allowRetry = true) => {
  const url = `${API_BASE}${path}`
  const token = accessToken.value || localStorage.getItem('accessToken')
  
  // Build headers manually to ensure Authorization is set
  const headers = {}

  const method = options.method || 'GET'
  if (method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = 'application/json'
  }
  
  if (token) {
    headers['Authorization'] = 'Bearer ' + token
  }
  
  if (options.headers) {
    Object.assign(headers, options.headers)
  }
  
  const res = await fetch(url, {
    method,
    body: options.body,
    headers: headers,
    credentials: 'include'
  })
  
  if (res.status === 401 && allowRetry && path !== '/auth/refresh') {
    await refreshAccessToken()
    const newToken = accessToken.value || localStorage.getItem('accessToken')
    if (newToken) {
      return apiFetch(path, options, false)
    }
  }
  
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `요청 실패 (${res.status})`)
  }
  
  return res.json().catch(() => ({}))
}

let postcodeScriptPromise = null

const ensureDaumPostcode = () => {
  if (postcodeScriptPromise) return postcodeScriptPromise
  postcodeScriptPromise = new Promise((resolve, reject) => {
    if (window.daum && window.daum.Postcode) {
      resolve()
      return
    }
    const scriptId = 'daum-postcode-script'
    const existing = document.getElementById(scriptId)
    if (existing) {
      existing.addEventListener('load', resolve, { once: true })
      existing.addEventListener('error', reject, { once: true })
      return
    }
    const script = document.createElement('script')
    script.id = scriptId
    script.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    script.addEventListener('load', resolve, { once: true })
    script.addEventListener('error', reject, { once: true })
    document.head.appendChild(script)
  })
  return postcodeScriptPromise
}

const pickPostcodeAddress = async () => {
  await ensureDaumPostcode()
  return new Promise((resolve, reject) => {
    let settled = false
    const settleOnce = (fn) => {
      if (settled) return
      settled = true
      fn()
    }
    try {
      new window.daum.Postcode({
        oncomplete: (data) => {
          const addr = (data.roadAddress || data.jibunAddress || data.address || '').trim()
          if (!addr) {
            settleOnce(() => reject(new Error('주소를 확인할 수 없습니다.')))
            return
          }
          settleOnce(() =>
            resolve({
              address: addr,
              buildingName: (data.buildingName || '').trim(),
              bname: (data.bname || '').trim()
            })
          )
        },
        onclose: () => {
          settleOnce(() => reject(new Error('주소 검색을 취소했습니다.')))
        }
      }).open()
    } catch (e) {
      settleOnce(() => reject(e))
    }
  })
}

const geocodeAddress = async (address) => {
  await initKakao()
  const services = window.kakao?.maps?.services
  const Geocoder = services?.Geocoder
  if (!Geocoder) {
    throw new Error('주소 좌표 변환 기능을 사용할 수 없습니다.')
  }
  const geocoder = new Geocoder()
  return new Promise((resolve, reject) => {
    geocoder.addressSearch(address, (result, status) => {
      const ok = services?.Status?.OK
      if (ok && status !== ok) {
        reject(new Error('주소 좌표 변환에 실패했습니다.'))
        return
      }
      const first = Array.isArray(result) ? result[0] : null
      const lat = Number(first?.y)
      const lng = Number(first?.x)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        reject(new Error('주소 좌표를 확인할 수 없습니다.'))
        return
      }
      resolve({ lat, lng })
    })
  })
}

const openFavoriteAdd = async () => {
  if (!isAuthenticated.value) {
    setFavoritesMessage('로그인 후 이용 가능한 서비스입니다.')
    return
  }
  try {
    const picked = await pickPostcodeAddress()
    const coords = await geocodeAddress(picked.address)
    favoriteAddAddress.value = picked.address
    favoriteAddName.value = (picked.buildingName || picked.bname || picked.address).trim()
    favoriteAddCoords.value = coords
    favoriteAddOpen.value = true
  } catch (err) {
    const message = err instanceof Error ? err.message : '주소 검색을 완료하지 못했습니다.'
    setFavoritesMessage(message)
  }
}

const closeFavoriteAdd = () => {
  favoriteAddOpen.value = false
  favoriteAddBusy.value = false
  favoriteAddAddress.value = ''
  favoriteAddName.value = ''
  favoriteAddCoords.value = null
}

const submitFavoriteAdd = async () => {
  if (favoriteAddBusy.value) return
  if (!favoriteAddCoords.value) {
    setFavoritesMessage('주소 좌표를 확인할 수 없습니다.')
    return
  }
  const description = String(favoriteAddName.value || '').trim() || favoriteAddAddress.value
  if (!description) {
    setFavoritesMessage('즐겨찾기 이름을 입력해 주세요.')
    return
  }
  favoriteAddBusy.value = true
  try {
    await apiFetch('/favorites', {
      method: 'POST',
      body: JSON.stringify({
        description,
        lat: favoriteAddCoords.value.lat,
        lng: favoriteAddCoords.value.lng,
        address: favoriteAddAddress.value
      })
    })
    closeFavoriteAdd()
    await loadFavorites()
  } catch (err) {
    const message = err instanceof Error ? err.message : '즐겨찾기 추가에 실패했습니다.'
    setFavoritesMessage(message)
  } finally {
    favoriteAddBusy.value = false
  }
}

const login = async (provider) => {
  authLoading.value = true
  authModalVisible.value = true
  try {
    const returnTo = `${window.location.origin}${window.location.pathname}`
    const data = await apiFetch(`/auth/oauth/${provider}/authorize-url?returnTo=${encodeURIComponent(returnTo)}`)
    window.location.href = data.authorizeUrl
  } catch (err) {
    const message = err instanceof Error ? err.message : '로그인 요청에 실패했습니다.'
    setGlobalMessage(message)
    authLoading.value = false
    authModalVisible.value = false
  }
}

const logout = async () => {
  try {
    await apiFetch('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({})
    })
  } finally {
    accessToken.value = ''
    localStorage.removeItem('accessToken')
    user.value = null
    favorites.value = []
    favoriteCards.value = []
  }
}

let refreshInFlight = null

const refreshAccessToken = async () => {
  if (refreshInFlight) {
    return refreshInFlight
  }

  refreshInFlight = (async () => {
    try {
      const data = await apiFetch('/auth/refresh', {
        method: 'POST',
        headers: { 'X-Client': 'web' },
        body: JSON.stringify({})
      })
      if (data.accessToken) {
        accessToken.value = data.accessToken
        try {
          localStorage.setItem('accessToken', data.accessToken)
        } catch {
          // If storage is unavailable (e.g., strict privacy mode), keep in-memory token for this session.
        }
      }
    } catch (err) {
      accessToken.value = ''
      localStorage.removeItem('accessToken')
    }
  })()

  try {
    await refreshInFlight
  } finally {
    refreshInFlight = null
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
  if (!accessToken.value) {
    favorites.value = []
    favoriteCards.value = []
    return
  }
  const requestSeq = favoritesRequestSeq.value + 1
  favoritesRequestSeq.value = requestSeq
  try {
    const [favoriteList, dashboardList] = await Promise.all([
      apiFetch('/favorites'),
      apiFetch('/favorites/dashboard')
    ])
    
    // 디버깅: API 응답 로깅
    console.log('[DEBUG] Favorites API response:', favoriteList)
    console.log('[DEBUG] Dashboard API response:', dashboardList)
    
    if (requestSeq !== favoritesRequestSeq.value) return

    const seenFavorites = new Set()
    favorites.value = (Array.isArray(favoriteList) ? favoriteList : []).filter((favorite) => {
      const key = favorite?.id ?? `${favorite?.lat}:${favorite?.lng}`
      if (seenFavorites.has(key)) return false
      seenFavorites.add(key)
      return true
    })

    const seenCards = new Set()
    favoriteCards.value = (Array.isArray(dashboardList) ? dashboardList : []).filter((card) => {
      const key = card?.id ?? `${card?.description}`
      if (seenCards.has(key)) return false
      seenCards.add(key)
      return true
    })
    
    // 디버깅: 처리된 데이터 로깅
    console.log('[DEBUG] Processed favoriteCards:', favoriteCards.value)
  } catch (err) {
    const message = err instanceof Error ? err.message : '즐겨찾기 데이터를 불러오지 못했습니다.'
    setFavoritesMessage(message)
  }
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

const forecastRangeOptions = computed(() => {
  return [FORECAST_API_HORIZON_HOURS]
})

const forecastAvailability = computed(() => {
  const entries = forecastRangeOptions.value.map((hours) => [hours, trimForecastByRange(allForecastHours.value, hours).length])
  return Object.fromEntries(entries)
})

const applyForecastRange = (hours) => {
  forecastHours.value = trimForecastByRange(allForecastHours.value, hours)
}

const formatTemperature = (value) => {
  if (value === null || value === undefined || value === '') return '-'
  const num = Number(value)
  if (!Number.isFinite(num)) return '-'
  const rounded = Math.round(num * 10) / 10
  if (Number.isInteger(rounded)) return String(rounded)
  return rounded.toFixed(1)
}

const formatWindSpeed = (value) => {
  if (value === null || value === undefined || value === '') return '-'
  const num = Number(value)
  if (!Number.isFinite(num)) return '-'
  return (Math.round(num * 10) / 10).toFixed(1)
}

const removeFavorite = async (favoriteId) => {
  if (deletingFavoriteIds.value.includes(favoriteId)) return
  deletingFavoriteIds.value = [...deletingFavoriteIds.value, favoriteId]
  try {
    await apiFetch(`/favorites/${favoriteId}`, { method: 'DELETE' })
    favorites.value = favorites.value.filter((favorite) => favorite.id !== favoriteId)
    favoriteCards.value = favoriteCards.value.filter((card) => card.id !== favoriteId)
    await loadFavorites()
  } catch (err) {
    const message = err instanceof Error ? err.message : '즐겨찾기 삭제에 실패했습니다.'
    setFavoritesMessage(message)
  } finally {
    deletingFavoriteIds.value = deletingFavoriteIds.value.filter((id) => id !== favoriteId)
  }
}

const favoriteLocationMarker = ref(null)

const selectFavorite = async (favorite) => {
  // 즐겨찾기 위치 정보 저장 (환경 상세에 표시용)
  selectedFavoriteLocation.value = {
    description: favorite?.description,
    address: favorite?.address,
    lat: Number(favorite?.lat),
    lng: Number(favorite?.lng)
  }
  
  const lat = Number(favorite?.lat)
  const lng = Number(favorite?.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    setFavoritesMessage('해당 즐겨찾기의 위치 정보를 찾지 못했습니다.')
    return
  }
  
  // 가장 가까운 측정소 찾기
  let nearestStationId = null
  let nearestDistance = Number.POSITIVE_INFINITY
  if (Array.isArray(stations.value)) {
    stations.value.forEach((station) => {
      const stationId = Number(station?.id)
      const stationLat = Number(station?.lat)
      const stationLng = Number(station?.lng)
      if (!Number.isFinite(stationId) || stationId <= 0) return
      if (!Number.isFinite(stationLat) || !Number.isFinite(stationLng)) return
      const distance = (stationLat - lat) ** 2 + (stationLng - lng) ** 2
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestStationId = stationId
      }
    })
  }
  
  if (nearestStationId) {
    await loadStationDetail(nearestStationId)
  }
  
  if (map.value) {
    map.value.setCenter(new window.kakao.maps.LatLng(lat, lng))
    // 즐겨찾기 위치 마커 표시
    showFavoriteLocationMarker(lat, lng)
  }
}

const showFavoriteLocationMarker = (lat, lng) => {
  // 기존 마커 제거
  if (favoriteLocationMarker.value) {
    favoriteLocationMarker.value.setMap(null)
    favoriteLocationMarker.value = null
  }
  
  // 기본 마커와 동일한 모양, 색상만 초록색으로 변경
  const markerImage = new window.kakao.maps.MarkerImage(
    'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png',
    new window.kakao.maps.Size(24, 35),
    { offset: new window.kakao.maps.Point(12, 35) }
  )
  
  // 새 마커 생성 (기본 마커와 동일하게)
  const marker = new window.kakao.maps.Marker({
    position: new window.kakao.maps.LatLng(lat, lng),
    map: map.value,
    image: markerImage
  })
  
  favoriteLocationMarker.value = marker
  
  // 줌 인 (더 가까이 보기)
  map.value.setLevel(4, { animate: true })
}

const loadStations = async () => {
  const requestSeq = stationsRequestSeq.value + 1
  stationsRequestSeq.value = requestSeq
  try {
    const snapshot = getMapSnapshot()
    if (!snapshot) {
      const data = await apiFetch('/stations')
      if (requestSeq !== stationsRequestSeq.value) return
      stations.value = Array.isArray(data.stations) ? data.stations : []
      renderStationMarkers(stations.value)
      return
    }
    const { swLat, swLng, neLat, neLng } = snapshot
    const data = await apiFetch(`/stations/bbox?swLat=${swLat}&swLng=${swLng}&neLat=${neLat}&neLng=${neLng}&limit=300`)
    if (requestSeq !== stationsRequestSeq.value) return
    stations.value = Array.isArray(data.stations) ? data.stations : []
    renderStationMarkers(stations.value)
  } catch (err) {
    if (requestSeq !== stationsRequestSeq.value) return
    const message = err instanceof Error ? err.message : '측정소 마커를 불러오지 못했습니다.'
    setGlobalMessage(message)
  }
}

const loadStationDetail = async (stationId) => {
  const resolvedId = Number(stationId)
  if (!Number.isFinite(resolvedId) || resolvedId <= 0) {
    setGlobalMessage('대상 식별자를 확인할 수 없습니다.')
    return
  }
  try {
    selectedStation.value = await apiFetch(`/stations/${resolvedId}`)
    
    // 디버깅: 측정소 상세 데이터 로깅
    console.log('[DEBUG] Station detail:', selectedStation.value)
    
    const data = await apiFetch(`/stations/${resolvedId}/forecast?hours=${FORECAST_API_HORIZON_HOURS}`)
    allForecastHours.value = Array.isArray(data) ? data : []
    applyForecastRange(forecastRange.value)
  } catch (err) {
    const message = err instanceof Error ? err.message : '환경 상세를 불러오지 못했습니다.'
    setGlobalMessage(message)
  }
}

const setForecastRange = (hours) => {
  forecastRange.value = hours
  applyForecastRange(hours)
}

const setStatus = (msg) => {
  statusMessage.value = msg
  if (msg) {
    setTimeout(() => {
      if (statusMessage.value === msg) statusMessage.value = ''
    }, 4000)
  }
}

const setFavoritesMessage = (msg) => {
  favoritesMessage.value = msg
  if (msg) {
    setTimeout(() => {
      if (favoritesMessage.value === msg) favoritesMessage.value = ''
    }, 4000)
  }
}

const setGlobalMessage = (msg) => {
  globalMessage.value = msg
  if (msg) {
    setTimeout(() => {
      if (globalMessage.value === msg) globalMessage.value = ''
    }, 4000)
  }
}

const initKakao = () => new Promise((resolve, reject) => {
  if (window.kakao && window.kakao.maps) return resolve()
  if (!KAKAO_KEY) {
    reject(new Error('Kakao API key가 없습니다. VITE_KAKAO_APP_KEY를 설정하세요.'))
    return
  }

  const ready = () => window.kakao.maps.load(resolve)
  const scriptId = 'kakao-map-sdk'
  const existing = document.getElementById(scriptId)
  if (existing) {
    if (window.kakao && window.kakao.maps) {
      ready()
      return
    }
    existing.addEventListener('load', ready, { once: true })
    existing.addEventListener('error', reject, { once: true })
    return
  }

  const script = document.createElement('script')
  script.id = scriptId
  script.src = `https://dapi.kakao.com/v2/maps/sdk.js?autoload=false&appkey=${KAKAO_KEY}&libraries=services`
  script.addEventListener('load', ready, { once: true })
  script.addEventListener('error', reject, { once: true })
  document.head.appendChild(script)
})

const clearMarkers = (list) => {
  list.forEach((m) => {
    m.setMap(null)
  })
  list.length = 0
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
  if (!map.value || !Array.isArray(items) || items.length === 0) return

  const sanitized = items
    .map((item) => {
      const stationId = Number(item?.id ?? item?.stationId)
      const lat = Number(item?.lat)
      const lng = Number(item?.lng)
      if (!Number.isFinite(stationId) || stationId <= 0) return null
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
      return { stationId, lat, lng }
    })
    .filter((item) => item !== null)

  stationMarkers.value.push(
    ...sanitized
      .map((item) => {
        const stationId = item.stationId
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
    setGlobalMessage(err.message)
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
      // loadPolygons() // 폴리곤 비활성화
    })
    await loadStations()
    // await loadPolygons() // 폴리곤 비활성화
  } catch (err) {
    setGlobalMessage(err.message)
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
  const hasAccessTokenFromStorage = Boolean(accessToken.value)
  const hasAccessTokenInHash = window.location.hash.includes('access_token=')
  authLoading.value = hasAccessTokenFromStorage || hasAccessTokenInHash
  authModalVisible.value = hasAccessTokenInHash

  if (hasAccessTokenInHash) {
    const hash = new URLSearchParams(window.location.hash.replace('#', ''))
    const token = hash.get('access_token')
    if (token) {
      accessToken.value = token
      localStorage.setItem('accessToken', token)
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }
  try {
    if (!accessToken.value || isJwtExpiredOrNearExpiry(accessToken.value)) {
      // Try to restore session using refresh_token cookie.
      // Also refresh proactively if stored access token is expired/near-expiry
      // to avoid a burst of initial 401s during bootstrap.
      await refreshAccessToken()
    }

    if (accessToken.value) {
      await loadMe()
      if (!user.value) {
        await refreshAccessToken()
        if (accessToken.value) {
          await loadMe()
        }
      }
      if (user.value) {
        await loadFavorites()
      }
    } else {
      user.value = null
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '로그인 정보를 확인하는 중 오류가 발생했습니다.'
    setGlobalMessage(message)
  } finally {
    authLoading.value = false
    authModalVisible.value = false
  }
  await initialize()
})
</script>

<template>
  <div class="app">
    <TopBar :user="user" :providers="providers" :auth-loading="authLoading" @login="login" @logout="logout" />

    <main class="layout layout--double">
      <section class="panel panel--sidebar">
        <div class="panel__section panel__hero panel__hero--compact">
          <div class="hero__eyebrow">ATMO LIVE</div>
          <h1 class="hero__title">지금 이 순간의 환경 흐름</h1>
          <p class="hero__desc">지도 바운드 기반 측정소 조회로 주변 환경을 빠르게 확인합니다.</p>
          <div class="hero__stats">
            <div class="stat">
              <span class="stat__label">표시 중</span>
              <strong class="stat__value">{{ stations.length }}</strong>
            </div>
            <div class="stat">
              <span class="stat__label">즐겨찾기</span>
              <strong class="stat__value">{{ favorites.length }}</strong>
            </div>
            <div class="stat">
              <span class="stat__label">선택</span>
              <strong class="stat__value">{{ selectedStation?.name || '-' }}</strong>
            </div>
          </div>
        </div>

        <StationDetail
          v-if="selectedStation"
          :selected-station="selectedStation"
          :favorite-location="selectedFavoriteLocation"
          :forecast-range="forecastRange"
          :forecast-hours="forecastHours"
          :format-forecast-time="formatForecastTime"
          :format-precip-type="formatPrecipType"
          :format-temperature="formatTemperature"
          :format-wind-speed="formatWindSpeed"
          :forecast-availability="forecastAvailability"
          :forecast-range-options="forecastRangeOptions"
          @set-forecast-range="setForecastRange"
        />

        <FavoritesList
          :favorites="favorites"
          :cards-by-id="favoriteCardsById"
          :deleting-ids="deletingFavoriteIds"
          :message="favoritesMessage"
          :favorite-cards="favoriteCards"
          @select="selectFavorite"
          @remove="removeFavorite"
          @add="openFavoriteAdd"
        />

        <div class="panel__section" v-if="favoriteAddOpen">
          <div class="card favorite-add">
            <p class="card__title">즐겨찾기 추가</p>
            <p class="card__meta">{{ favoriteAddAddress }}</p>
            <label class="label" for="favoriteAddName">이름</label>
            <input
              id="favoriteAddName"
              class="input"
              v-model="favoriteAddName"
              type="text"
              autocomplete="off"
              placeholder="예: 우리집, 회사"
            />
            <div class="favorite-add__actions">
              <button class="ghost" type="button" @click="closeFavoriteAdd" :disabled="favoriteAddBusy">취소</button>
              <button class="primary" type="button" @click="submitFavoriteAdd" :disabled="favoriteAddBusy">+ 추가</button>
            </div>
          </div>
        </div>
      </section>

      <section class="map">
        <div class="map__canvas" ref="mapEl"></div>
        <div class="map__status" v-if="loading">지도 데이터를 불러오는 중...</div>
      </section>

      <div class="global-toast" v-if="globalMessage">{{ globalMessage }}</div>
    </main>

    <div v-if="authLoading && authModalVisible" class="auth-modal" role="dialog" aria-modal="true" aria-live="polite">
      <div class="auth-modal__backdrop"></div>
      <div class="auth-modal__panel">
        <span class="auth-modal__spinner" aria-hidden="true"></span>
        <p class="auth-modal__title">로그인 확인 중입니다</p>
        <p class="auth-modal__desc">계정 상태를 안전하게 확인하고 있어요.</p>
        <p class="auth-modal__wait">잠시만 기다려 주세요<span class="auth-modal__dots" aria-hidden="true"></span></p>
      </div>
    </div>
  </div>
</template>
