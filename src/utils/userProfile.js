const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const GENERIC_NAME_TOKENS = ['계정', '연동', 'google', 'kakao', 'naver', '구글', '카카오', '네이버']

const isOpaqueName = (value) => {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (!trimmed) return false
  if (UUID_PATTERN.test(trimmed)) return true
  return /^[0-9]{10,}$/.test(trimmed)
}

const isProviderPlaceholderName = (name, providerLabel) => {
  if (!name) return false
  const normalized = name.toLowerCase().replace(/\s+/g, '')
  const providerToken = (providerLabel || '').toLowerCase().replace(/\s+/g, '')
  if (providerToken && normalized === providerToken) return true
  return GENERIC_NAME_TOKENS.some((token) => normalized.includes(token))
}

const shortUserId = (value) => {
  if (typeof value !== 'string') return ''
  const normalized = value.trim().replace(/[^a-zA-Z0-9]/g, '')
  if (!normalized) return ''
  return normalized.slice(0, 8)
}

export const normalizeUser = (raw, providerDisplayMap) => {
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

  return {
    ...raw,
    provider,
    providerLabel,
    displayName,
    displayNameUi: friendlyName ? `${friendlyName}님` : displayName,
    identityLabel: friendlyName ? '이름' : (idLabel ? '계정 ID' : '계정'),
    accountLabel: friendlyName || (idLabel ? `ID ${idLabel}` : providerLabel)
  }
}
