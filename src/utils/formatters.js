const toFiniteNumber = (value) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

export const formatTemperature = (value) => {
  const num = toFiniteNumber(value)
  if (num === null) return '-'
  const rounded = Math.round(num * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

export const formatWindSpeed = (value) => {
  const num = toFiniteNumber(value)
  if (num === null) return '-'
  return (Math.round(num * 10) / 10).toFixed(1)
}

export const formatForecastTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

export const formatPrecipType = (value) => {
  if (!value || value === 'NONE' || value === '0') return '없음'
  const map = {
    1: '비',
    2: '비/눈',
    3: '눈',
    4: '소나기'
  }
  return map[value] || value
}

export const formatDataTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
