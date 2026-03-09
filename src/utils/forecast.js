const parseForecastTime = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export const trimForecastByRange = (items, hours) => {
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
      const leftTime = parseForecastTime(a?.forecastAt)?.getTime() ?? Number.MAX_SAFE_INTEGER
      const rightTime = parseForecastTime(b?.forecastAt)?.getTime() ?? Number.MAX_SAFE_INTEGER
      return leftTime - rightTime
    })
}
