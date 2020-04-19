import { IopaContext } from 'iopa-types'

export function isObject(value) {
  return (
    typeof value === 'object' &&
    value != null &&
    !(value instanceof Boolean) &&
    !(value instanceof Date) &&
    !(value instanceof Number) &&
    !(value instanceof RegExp) &&
    !(value instanceof String)
  )
}

export function isDate(value) {
  return value instanceof Date
}

export function isFunction(value) {
  return typeof value === 'function' && value != null
}

export function decycle(defaultSeen: [any, string][]) {
  const seen = new WeakSet<any>(defaultSeen.map(entry => entry[0]))
  const paths = new WeakMap<any, string[]>(
    defaultSeen.map(entry => [entry[0], entry[1].split('/')])
  )

  return function replacer(this: Function, key, value) {
    if (['server.Timestamp', 'urn:engine:initTime'].includes(key)) {
      return value ? new Date(value).toISOString() : undefined
    }
    if (['urn:server:timestamp', 'updated', 'bot.Timestamp'].includes(key)) {
      return value ? new Date(value * 1000).toISOString() : undefined
    }

    if (key !== '$ref' && isObject(value)) {
      if (seen.has(value)) {
        return { $ref: toPointer(paths.get(value)) }
      }
      paths.set(value, (paths.get(this) || []).concat([key]))
      seen.add(value)
    }

    if (key !== '$ref' && isFunction(value)) {
      if (seen.has(value)) {
        return { $ref: toPointer(paths.get(value)) }
      }
      paths.set(value, (paths.get(this) || []).concat([key]))
      seen.add(value)

      return `function(${getParamNames(value).join(', ')})`
    }

    return value
  }

  function toPointer(parts) {
    return `#${parts
      .map(function mapPart(part) {
        return part
          .toString()
          .replace(/~/g, '~0')
          .replace(/\//g, '~1')
      })
      .join('/')}`
  }
}

export function retrocycle() {
  const parents = new WeakMap()
  const refs = new Set()

  return function reviver(this: Function, key, value) {
    if (key === '$ref') {
      refs.add(this)
    } else if (isObject(value)) {
      const isRoot = key === '' && Object.keys(this).length === 1
      if (isRoot) {
        refs.forEach(dereference, this)
      } else {
        parents.set(value, this)
      }
    }

    return value
  }

  function dereference(this: any, ref) {
    const parts = ref.$ref.slice(1).split('/')
    let key
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let value = this
    for (let i = 0; i < parts.length; i++) {
      key = parts[i].replace(/~1/g, '/').replace(/~0/g, '~')
      value = value[key]
    }
    const parent = parents.get(ref)
    parent[key] = value
  }
}

const STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/gm
const ARGUMENT_NAMES = /([^\s,]+)/g
export function getParamNames(func) {
  const fnStr = func.toString().replace(STRIP_COMMENTS, '')
  let result = fnStr
    .slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')'))
    .match(ARGUMENT_NAMES)
  if (result === null) {
    result = []
  }
  return result
}

export function cleanContext(context: IopaContext) {
  return Object.entries(context)
    .filter(
      ([key, _]) =>
        [
          'get',
          'set',
          'delete',
          'toJSON',
          'capability',
          'setCapability',
          'server.Capabilities',
          'server.CancelToken',
          'server.CancelTokenSource',
          'create',
          'dispose',
          'response',
          'log',
          'done',
          'key',
          'bot.Session'
        ].indexOf(key) === -1
    )
    .reduce((result, [key, value]) => {
      result[key] = value
      return result
    }, {} as IopaContext)
}

export function getArrayWithLimitedLength(length) {
  const array = []

  Object.defineProperty(array, 'push', {
    value: function push(item) {
      if (this.length >= length) {
        this.shift()
      }
      return Array.prototype.push.call(this, item)
    },
    enumerable: false
  })

  return array
}

export const cleanObjectOfUndefinedValues = obj =>
  Object.entries(obj).reduce((a, [k, v]) => (v ? { ...a, [k]: v } : a), {})

export const addOptionalArrayToObject = (obj, params: any[]) => {
  if (params.length) {
    obj.params = params
  }
  return obj
}
