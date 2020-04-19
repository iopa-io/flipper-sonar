export function convertToJson(value) {
  if (
    typeof value === 'string' &&
    (value.startsWith('{') || value.startsWith('['))
  ) {
    try {
      return JSON.parse(value)
    } catch (e) {
      /** noop */
    }
  }
  return value
}

export function formatTimestamp(date: Date) {
  return `${pad(date.getHours(), 2)}:${pad(date.getMinutes(), 2)}:${pad(
    date.getSeconds(),
    2
  )}.${pad(date.getMilliseconds(), 3)}`
}

export function pad(num, size) {
  let s = `${num}`
  while (s.length < size) {
    s = `0${s}`
  }
  return s
}

const dateFormat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

function getParseDates() {
  const seen = new Map<string, Date>()

  return function parseDates(key, value) {
    if (typeof value === 'string' && dateFormat.test(value)) {
      if (seen.has(value)) {
        return seen.get(value)
      }

      const date = new Date(value)
      seen.set(value, date)
      return date
    }

    return value
  }
}

export function reParseDates(data) {
  return JSON.parse(JSON.stringify(data), getParseDates())
}
