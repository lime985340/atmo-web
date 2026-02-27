const METRIC_CLASS = 'metric'
const DOT_CLASS = 'fav__dot'

const GRADE_CLASS_MAP = {
  1: {
    badge: 'badge badge--good',
    metric: `${METRIC_CLASS} ${METRIC_CLASS}--good`,
    dot: `${DOT_CLASS} ${DOT_CLASS}--good`,
    label: '좋음'
  },
  2: {
    badge: 'badge badge--ok',
    metric: `${METRIC_CLASS} ${METRIC_CLASS}--ok`,
    dot: `${DOT_CLASS} ${DOT_CLASS}--ok`,
    label: '보통'
  },
  3: {
    badge: 'badge badge--bad',
    metric: `${METRIC_CLASS} ${METRIC_CLASS}--bad`,
    dot: `${DOT_CLASS} ${DOT_CLASS}--bad`,
    label: '나쁨'
  },
  4: {
    badge: 'badge badge--verybad',
    metric: `${METRIC_CLASS} ${METRIC_CLASS}--verybad`,
    dot: `${DOT_CLASS} ${DOT_CLASS}--verybad`,
    label: '매우나쁨'
  }
}

const PM10_THRESHOLDS = [30, 80, 150]
const PM25_THRESHOLDS = [15, 35, 75]

const toFiniteNumber = (value) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

const gradeFromThresholds = (value, thresholds) => {
  if (value === null) return null
  if (value <= thresholds[0]) return 1
  if (value <= thresholds[1]) return 2
  if (value <= thresholds[2]) return 3
  return 4
}

export const resolveAirQualityGrade = ({ explicitGrade, pm10, pm25 }) => {
  const rawGrade = toFiniteNumber(explicitGrade)
  if (rawGrade !== null && rawGrade >= 1) return rawGrade

  const pm10Grade = gradeFromThresholds(toFiniteNumber(pm10), PM10_THRESHOLDS)
  const pm25Grade = gradeFromThresholds(toFiniteNumber(pm25), PM25_THRESHOLDS)

  if (pm10Grade === null) return pm25Grade
  if (pm25Grade === null) return pm10Grade
  return Math.max(pm10Grade, pm25Grade)
}

export const getAirQualityLabel = (grade) => {
  return GRADE_CLASS_MAP[grade]?.label || '미측정'
}

export const getAirQualityBadgeClass = (grade) => {
  return GRADE_CLASS_MAP[grade]?.badge || 'badge badge--unknown'
}

export const getAirQualityMetricClass = (grade) => {
  return GRADE_CLASS_MAP[grade]?.metric || METRIC_CLASS
}

export const getFavoriteDotClass = (grade) => {
  return GRADE_CLASS_MAP[grade]?.dot || `${DOT_CLASS} ${DOT_CLASS}--unknown`
}

export const getPm10Grade = (value) => gradeFromThresholds(toFiniteNumber(value), PM10_THRESHOLDS)
export const getPm25Grade = (value) => gradeFromThresholds(toFiniteNumber(value), PM25_THRESHOLDS)

export const getPm10MetricClass = (value) => {
  const grade = getPm10Grade(value)
  return getAirQualityMetricClass(grade)
}

export const getPm25MetricClass = (value) => {
  const grade = getPm25Grade(value)
  return getAirQualityMetricClass(grade)
}

export const getPm10Label = (value) => {
  const grade = getPm10Grade(value)
  return grade ? getAirQualityLabel(grade) : '-'
}

export const getPm25Label = (value) => {
  const grade = getPm25Grade(value)
  return grade ? getAirQualityLabel(grade) : '-'
}
