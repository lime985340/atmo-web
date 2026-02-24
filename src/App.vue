<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import TopBar from './components/TopBar.vue'
import StationDetail from './components/StationDetail.vue'
import FavoritesList from './components/FavoritesList.vue'
import DashboardPanel from './components/DashboardPanel.vue'
import AuthModal from './components/AuthModal.vue'
import ApiLogoutDialog from './components/ApiLogoutDialog.vue'
import { providerDisplayMap } from './auth/providers'

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1'
const KAKAO_KEY = import.meta.env.VITE_KAKAO_APP_KEY || ''
const FORECAST_API_HORIZON_HOURS = 6

const mapEl = ref(null)
const map = ref(null)
let mapResizeObserver = null
let mapRelayoutRaf = 0
const stationMarkers = ref([])
const polygonOverlays = ref([])
const polygonCache = new Map()
const lastPolygonKey = ref('')

const loading = ref(false)
const user = ref(null)
const authLoading = ref(true)
const authModalVisible = ref(false)
const authModalTitle = ref('')
const authModalDesc = ref('')
const apiLogoutDialogVisible = ref(false)
const accessToken = ref(localStorage.getItem('accessToken') || '')
const deletingFavoriteIds = ref([])
const stationDetailLoading = ref(false)
const selectionSeq = ref(0)
let stationDetailAbortController = null

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

const openAuthRedirectModal = (provider) => {
  const key = String(provider || '').toLowerCase()
  const label = providerDisplayMap[key] || '소셜'
  authModalTitle.value = `${label} 로그인을 진행합니다`
  authModalDesc.value = ''
  authModalVisible.value = true
}

const openAuthCheckingModal = () => {
  authModalVisible.value = true
  authModalTitle.value = '로그인 확인 중입니다'
  authModalDesc.value = '계정 상태를 안전하게 확인하고 있어요.'
}

const closeAuthModal = () => {
  authModalVisible.value = false
  authModalTitle.value = ''
  authModalDesc.value = ''
}

const clearAuthSession = () => {
  accessToken.value = ''
  localStorage.removeItem('accessToken')
  user.value = null
  favorites.value = []
  favoriteCards.value = []
}

const openApiLogoutDialog = () => {
  if (authLoading.value) return
  if (apiLogoutDialogVisible.value) return
  apiLogoutDialogVisible.value = true
}

const closeApiLogoutDialog = () => {
  apiLogoutDialogVisible.value = false
}

const onPageShow = (event) => {
  if (event.persisted) {
    closeAuthModal()
  }
}

const onPageHide = () => {
  closeAuthModal()
}

window.addEventListener('pageshow', onPageShow)
window.addEventListener('pagehide', onPageHide)
onUnmounted(() => {
  window.removeEventListener('pageshow', onPageShow)
  window.removeEventListener('pagehide', onPageHide)
})

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
    credentials: 'include',
    signal: options.signal
  })
  
  if (res.status === 401 && allowRetry && path !== '/auth/refresh') {
    await refreshAccessToken()
    const newToken = accessToken.value || localStorage.getItem('accessToken')
    if (newToken) {
      return apiFetch(path, options, false)
    }
  }

  if (res.status === 401) {
    clearAuthSession()
    openApiLogoutDialog()
    throw new Error('로그인 상태가 만료되었습니다. 다시 로그인해 주세요.')
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
  try {
    openAuthRedirectModal(provider)
    await nextTick()
    await new Promise((resolve) => requestAnimationFrame(() => resolve()))
    const returnTo = `${window.location.origin}${window.location.pathname}`
    const data = await apiFetch(`/auth/oauth/${provider}/authorize-url?returnTo=${encodeURIComponent(returnTo)}`)
    window.location.href = data.authorizeUrl
  } catch (err) {
    closeAuthModal()
    const message = err instanceof Error ? err.message : '로그인 요청에 실패했습니다.'
    setGlobalMessage(message)
  }
}

const logout = async () => {
  try {
    await apiFetch('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({})
    })
  } finally {
    clearAuthSession()
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
      clearAuthSession()
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

    // 즐겨찾기 목록이 늘어나며 레이아웃이 변할 수 있어, 지도 relayout을 한번 보장
    await nextTick()
    scheduleMapRelayout()
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

const cardToStationDetail = (card) => {
  if (!card || typeof card !== 'object') return null
  return {
    id: Number(card.id) || null,
    name: card.description || '즐겨찾기',
    addr: card.address || '',
    air: {
      pm10: card.pm10 ?? null,
      pm25: card.pm25 ?? null,
      grade: card.grade ?? null,
      dataTime: card.airDataTime ?? null
    },
    weather: {
      obsTime: card.weatherObsTime ?? null,
      temp: card.tempC ?? null,
      humidity: card.humidity ?? null,
      windSpeed: card.windSpeed ?? null,
      precip: card.precipMm ?? null
    }
  }
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

const beginSelection = () => {
  selectionSeq.value += 1
  return selectionSeq.value
}

const selectFavorite = async (favorite) => {
  const currentSelectionSeq = beginSelection()

  const stationFromCard = cardToStationDetail(favorite)
  if (stationFromCard) {
    selectedStation.value = stationFromCard
    allForecastHours.value = Array.isArray(favorite?.forecastHours) ? favorite.forecastHours : []
    applyForecastRange(forecastRange.value)
  }

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

  const stationId = Number(favorite?.stationId)
  if (Number.isFinite(stationId) && stationId > 0) {
    await loadStationDetail(stationId, currentSelectionSeq)
  }

  if (currentSelectionSeq !== selectionSeq.value) {
    return
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
  
  // 측정소 기본 마커와 같은 "핀" 형태로, 색상만 초록색으로 표시
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="35" viewBox="0 0 24 35">
      <path d="M12 0C5.9 0 1 4.9 1 11c0 8.4 11 24 11 24s11-15.6 11-24C23 4.9 18.1 0 12 0z" fill="#22c55e" stroke="#ffffff" stroke-width="2"/>
      <circle cx="12" cy="11" r="4" fill="#ffffff"/>
    </svg>
  `.trim()
  const markerImage = new window.kakao.maps.MarkerImage(
    'data:image/svg+xml;base64,' + btoa(svg),
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

const loadStationDetail = async (stationId, currentSelectionSeq = selectionSeq.value) => {
  const resolvedId = Number(stationId)
  if (!Number.isFinite(resolvedId) || resolvedId <= 0) {
    setGlobalMessage('대상 식별자를 확인할 수 없습니다.')
    return
  }

  if (currentSelectionSeq !== selectionSeq.value) {
    return
  }

  if (stationDetailAbortController) {
    stationDetailAbortController.abort()
  }
  const abortController = new AbortController()
  stationDetailAbortController = abortController

  // 이전 선택된 측정소는 유지하되 로딩 상태 표시 (또는 null로 설정)
  stationDetailLoading.value = true
  
  try {
    // 측정소 상세 정보 로드
    const stationData = await apiFetch(`/stations/${resolvedId}`, { signal: abortController.signal })
    if (currentSelectionSeq !== selectionSeq.value || abortController.signal.aborted) return
    selectedStation.value = stationData
    
    // 디버깅: 측정소 상세 데이터 로깅
    console.log('[DEBUG] Station detail:', selectedStation.value)
    
    // 예보 데이터 로드
    const forecastData = await apiFetch(`/stations/${resolvedId}/forecast?hours=${FORECAST_API_HORIZON_HOURS}`, { signal: abortController.signal })
    if (currentSelectionSeq !== selectionSeq.value || abortController.signal.aborted) return
    allForecastHours.value = Array.isArray(forecastData) ? forecastData : []
    applyForecastRange(forecastRange.value)
  } catch (err) {
    if (abortController.signal.aborted) return
    if (currentSelectionSeq !== selectionSeq.value) return
    const message = err instanceof Error ? err.message : '환경 상세를 불러오지 못했습니다.'
    setGlobalMessage(message)
    // 에러 발생 시 selectedStation을 null로 설정하여 에러 상태 표시
    selectedStation.value = null
  } finally {
    if (stationDetailAbortController === abortController) {
      stationDetailAbortController = null
    }
    if (currentSelectionSeq === selectionSeq.value) {
      stationDetailLoading.value = false
    }
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
          const currentSelectionSeq = beginSelection()
          // 측정소 마커 클릭 시: 즐겨찾기 위치 정보는 해제하고 측정소 주소/이름을 보여준다.
          selectedFavoriteLocation.value = null
          loadStationDetail(stationId, currentSelectionSeq)
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

    // KakaoMap은 컨테이너 크기 변경 시 자동 리레이아웃이 되지 않아서,
    // 사이드바가 늘어나며 map 영역 높이가 바뀌는 경우 타일이 비어 보일 수 있음.
    // ResizeObserver로 map.relayout()를 호출해 렌더링을 강제 갱신한다.
    setupMapResizeObserver()

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

const scheduleMapRelayout = () => {
  if (!map.value) return
  if (mapRelayoutRaf) cancelAnimationFrame(mapRelayoutRaf)
  mapRelayoutRaf = requestAnimationFrame(() => {
    mapRelayoutRaf = 0
    try {
      const center = map.value.getCenter()
      map.value.relayout()
      map.value.setCenter(center)
    } catch {
      // relayout 실패는 UX에만 영향, 무시
    }
  })
}

const setupMapResizeObserver = () => {
  if (!mapEl.value || !window.ResizeObserver) return
  if (mapResizeObserver) return
  mapResizeObserver = new ResizeObserver(() => {
    scheduleMapRelayout()
  })
  mapResizeObserver.observe(mapEl.value)
}

onUnmounted(() => {
  if (stationDetailAbortController) {
    stationDetailAbortController.abort()
    stationDetailAbortController = null
  }
  if (mapResizeObserver && mapEl.value) {
    mapResizeObserver.unobserve(mapEl.value)
  }
  mapResizeObserver = null
  if (mapRelayoutRaf) cancelAnimationFrame(mapRelayoutRaf)
  mapRelayoutRaf = 0
})

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
  const hasAccessTokenInHash = window.location.hash.includes('access_token=')

  if (hasAccessTokenInHash) {
    const hash = new URLSearchParams(window.location.hash.replace('#', ''))
    const token = hash.get('access_token')
    if (token) {
      accessToken.value = token
      localStorage.setItem('accessToken', token)
      window.history.replaceState({}, document.title, window.location.pathname)
      openAuthCheckingModal()
    }
  }
  
  // 지도 초기화와 인증을 병렬로 실행 (초기 렌더링 블로킹 없음)
  // 각 작업은 개별적으로 완료되면 UI 업데이트
  initialize().catch(err => {
    console.error('Map initialization failed:', err)
    setGlobalMessage('지도 로딩에 실패했습니다.')
  })
  
  // 인증 확인 (비동기로 실행, 초기 렌더링 차단 없음)
  ;(async () => {
    try {
      if (!accessToken.value || isJwtExpiredOrNearExpiry(accessToken.value)) {
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
      closeAuthModal()
    }
  })()
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
              <strong class="stat__value">{{ selectedFavoriteLocation?.description || selectedStation?.name || '-' }}</strong>
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
          :is-loading="stationDetailLoading"
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

    <AuthModal
      :visible="authModalVisible"
      :title="authModalTitle"
      :desc="authModalDesc"
    />
    <ApiLogoutDialog
      :visible="apiLogoutDialogVisible"
      title="로그인이 해제되었습니다"
      desc="요청 처리 중 로그아웃 상태가 확인되었습니다. 다시 로그인해 주세요."
      confirm-label="확인"
      @confirm="closeApiLogoutDialog"
    />
  </div>
</template>
