/* eslint-disable @typescript-eslint/no-unused-vars */
import * as dgram from 'dgram'
import * as events from 'events'
import * as os from 'os'

const SSDP_ADDRESS_IPV4 = '239.255.255.250'
const SSDP_PORT = 8087

const MAX_AGE = 'max-age=1800'
const TTL = 128
const MX = 2
const SSDP_HELLO = 'ssdp:alive'
const SSDP_BYE = 'ssdp:byebye'
const SSDP_UPDATE = 'ssdp:update'

const TYPE_M_SEARCH = 'M-SEARCH'
const TYPE_NOTIFY = 'NOTIFY'
const TYPE_200_OK = '200 OK'

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface SsdpSocketOptions {
  ssdpPort?: number
  ssdpAddress?: string
  family?: 'IPv4' | 'IPv6'
  alPorts?: Record<string, number>
}

export type SSDP_MESSAGE_TYPE =
  | 'ssdp:alive'
  | 'ssdp:byebye'
  | 'ssdp:update'
  | 'ssdp:all'

export interface SsdpHeaders {
  /** Service name */
  S?: string
  /** [URI indicating the notify target device type]  */
  NT?: string
  /** [URI indicating the search target device type]  */
  ST?: string
  /** The SSDP message type alive, byebye, update or all */
  NTS?: SSDP_MESSAGE_TYPE
  /** [URI identifying this unique instance of device/service] */
  USN?: string
  /** [OS and version] UPnP/1.0 [Product-Name]/[Product-Version] */
  SERVER?: string
  /** Field value contains a URL to the UPnP description of the root device */
  LOCATION?: string
  /** how long the message is valid. */
  ['CACHE-CONTROL']?: string
  /**  host value 239.255.255.250:1900 */
  HOST?: string
  /** Recommended. Field value contains date when response was generated. “rfc1123-date”. */
  DATE?: string
  /** Required for backwards compatibility with UPnP 1.0. (Header field name only; no field value.) */
  EXT?: string
  /** Always ssdp:discover for M-SEARCH */
  MAN?: string
  /** maximum wait response time in seconds before responding  */
  MX?: number
  /* application-specific URI */
  AL?: string
}

interface RemoteInfo {
  address: string
  family: 'IPv4' | 'IPv6'
  port: number
  size: number
}

export class SsdpSocket extends events.EventEmitter {
  protected socketManager: SocketManager

  protected mcSocket: MulitcastSocketGroup

  protected ucSocket: UnicastSocketGroup

  protected options: SsdpSocketOptions

  protected get ssdpHost() {
    return this.options.family === 'IPv6'
      ? `[${this.options.ssdpAddress}]:${this.options.ssdpPort}`
      : `${this.options.ssdpAddress}:${this.options.ssdpPort}`
  }

  protected get alHost() {
    return JSON.stringify(
      Object.fromEntries(
        Object.keys(this.options.alPorts).map(key => [
          key,
          {
            host: this.addresses[0],
            port: this.options.alPorts[key],
            family: this.options.family
          }
        ])
      )
    )
  }

  public get addresses() {
    return Object.keys(this.socketManager.socketMap)
  }

  constructor(options?: Partial<SsdpSocketOptions>) {
    super()
    const {
      ssdpPort = SSDP_PORT,
      ssdpAddress = (options || {}).family === 'IPv4'
        ? SSDP_ADDRESS_IPV4
        : SSDP_ADDRESS_IPV4,
      family = 'IPv4', // v6 not currently supported
      alPorts = {}
    } = options || {}
    this.options = { ssdpPort, family, ssdpAddress, alPorts }
    const socketManager = new SocketManager(this, this.options)
    this.socketManager = socketManager
    this.mcSocket = new MulitcastSocketGroup(socketManager)
    this.ucSocket = new UnicastSocketGroup(socketManager)
  }

  notify(headers: SsdpHeaders) {
    headers.HOST = this.ssdpHost
    headers['CACHE-CONTROL'] = headers['CACHE-CONTROL'] || MAX_AGE
    headers.EXT = headers.EXT || ''
    headers.DATE = headers.DATE || new Date().toUTCString()

    if (Object.keys(this.options.alPorts).length > 0) {
      headers.AL = this.alHost
    }

    return new Promise((resolve, reject) => {
      this.mcSocket.send({
        msg: Buffer.from(serialize(`${TYPE_NOTIFY} * HTTP/1.1`, headers)),
        port: this.options.ssdpPort,
        address: this.options.ssdpAddress,
        callback: (err, bytes) => {
          if (err) {
            reject(err)
          } else {
            resolve(bytes)
          }
        }
      })
    })
  }

  hello(headers: SsdpHeaders) {
    return this.notify({ NTS: SSDP_HELLO, ...headers })
  }

  bye(headers: SsdpHeaders) {
    return this.notify({ NTS: SSDP_BYE, ...headers })
  }

  update(headers: SsdpHeaders) {
    return this.notify({ NTS: SSDP_UPDATE, ...headers })
  }

  search(headers: SsdpHeaders) {
    headers.HOST = this.ssdpHost
    headers.MAN = '"ssdp:discover"'
    headers.MX = headers.MX || MX

    return new Promise((resolve, reject) => {
      this.ucSocket.send(networkInterfaceAddress => ({
        msg: Buffer.from(
          serialize(
            `${TYPE_M_SEARCH} * HTTP/1.1`,
            headers,
            networkInterfaceAddress
          )
        ),
        port: this.options.ssdpPort,
        address: this.options.ssdpAddress,
        callback: (err, bytes) => {
          if (err) {
            reject(err)
          } else {
            resolve(bytes)
          }
        }
      }))
    })
  }

  async searchFirst(
    headers: SsdpHeaders,
    ms: number
  ): Promise<[SsdpHeaders, RemoteInfo]> {
    await this.search(headers)

    return new Promise<any>((resolve, reject) => {
      let called = false

      const handlerProxy = (foundHeaders: SsdpHeaders, address: RemoteInfo) => {
        if (foundHeaders.ST === headers.ST) {
          this.removeListener('found', handlerProxy)
          called = true
          clearTimeout(timerId)
          resolve([foundHeaders, address])
        }
      }

      const timerId = setTimeout(() => {
        this.removeListener('found', handlerProxy)
        if (!called) {
          reject(new Error(`Timed out in ${ms}ms.`))
        }
      }, ms)

      this.on('found', handlerProxy)
    })
  }

  async getAnnounceFirst(
    headers: SsdpHeaders,
    ms: number
  ): Promise<[SsdpHeaders, RemoteInfo]> {
    return new Promise<any>((resolve, reject) => {
      let called = false

      const handlerProxy = (foundHeaders: SsdpHeaders, address: RemoteInfo) => {
        if (
          foundHeaders.NTS === 'ssdp:alive' &&
          foundHeaders.NT === headers.NT
        ) {
          this.removeListener('notify', handlerProxy)
          called = true
          clearTimeout(timerId)
          resolve([foundHeaders, address])
        }
      }

      const timerId = setTimeout(() => {
        this.removeListener('notify', handlerProxy)
        if (!called) {
          reject(new Error(`Timed out in ${ms}ms.`))
        }
      }, ms)
      this.on('notify', handlerProxy)
    })
  }

  waitUntil(event: string, ms: number): Promise<[SsdpHeaders, RemoteInfo]> {
    return eventTimeout(ms, this, event)
  }

  reply(headers: SsdpHeaders, address: RemoteInfo) {
    headers.HOST = this.ssdpHost
    headers['CACHE-CONTROL'] = headers['CACHE-CONTROL'] || MAX_AGE
    headers.EXT = headers.EXT || ''
    headers.DATE = headers.DATE || new Date().toUTCString()

    if (Object.keys(this.options.alPorts).length > 0) {
      headers.AL = this.alHost
    }

    return new Promise((resolve, reject) => {
      this.ucSocket.send(networkInterfaceAddress => ({
        msg: Buffer.from(
          serialize(`HTTP/1.1 ${TYPE_200_OK}`, headers, networkInterfaceAddress)
        ),
        port: address.port,
        address: address.address,
        callback: (err, bytes) => {
          if (err) {
            reject(err)
          } else {
            resolve(bytes)
          }
        }
      }))
    })
  }

  close() {
    this.socketManager.stop()
    if (this.mcSocket) {
      this.mcSocket.close()
    }
    if (this.ucSocket) {
      this.ucSocket.close()
    }
  }

  start() {
    this.socketManager.start()
  }
}

class SocketManager {
  public socketMap: Record<
    string,
    { unicast: dgram.Socket; multicast: dgram.Socket }
  >

  interfaceDiscoveryHandle: NodeJS.Timeout

  emitter: events.EventEmitter

  options: SsdpSocketOptions

  constructor(emitter: events.EventEmitter, options: SsdpSocketOptions) {
    this.emitter = emitter
    this.options = options
    this.socketMap = {}
  }

  public start() {
    const interfaces = os.networkInterfaces()
    Object.keys(interfaces).forEach(key => {
      const infoArray = interfaces[key]
      infoArray.forEach(info => {
        if (info.family === this.options.family && !info.internal) {
          this.onNewInterface(
            this.options.family === 'IPv6'
              ? `${info.address}::%${key}`
              : info.address
          )
        }
      })
    })

    this.interfaceDiscoveryHandle = setInterval(() => {
      const currentInterfaces = {}
      const interfaces = os.networkInterfaces()

      Object.keys(interfaces).forEach(key => {
        const infoArray = interfaces[key]
        infoArray.forEach(info => {
          if (info.family === this.options.family && !info.internal) {
            currentInterfaces[
              this.options.family === 'IPv6'
                ? `${info.address}::%${key}`
                : info.address
            ] = true
          }
        })
      })

      Object.keys(currentInterfaces).forEach(key => {
        if (
          this.socketMap[key] &&
          this.socketMap[key].multicast &&
          this.socketMap[key].unicast
        ) {
          // known address
        } else {
          // new address
          this.onNewInterface(key)
        }
      })

      Object.keys(this.socketMap).forEach(key => {
        if (
          this.socketMap[key] &&
          this.socketMap[key].multicast &&
          this.socketMap[key].unicast &&
          !currentInterfaces[key]
        ) {
          this.socketMap[key].multicast.close()
          delete this.socketMap[key].multicast
          this.socketMap[key].unicast.close()
          delete this.socketMap[key].unicast
        }
      })
    }, 15000)
  }

  public stop() {
    if (this.interfaceDiscoveryHandle) {
      clearInterval(this.interfaceDiscoveryHandle)
    }
  }

  private onNewInterface = (adr: string) => {
    let ready = 0

    const onMessage = (msg: Buffer, address: RemoteInfo) => {
      const req = deserialize(msg)
      this.emitter.emit(req.type, req.headers, address)
    }

    const onListening = () => {
      this.emitter.emit('listening')
    }

    const onClose = err => {
      if (--ready <= 0) {
        this.emitter.emit('close', err)
        ready = 0
      }
    }

    const onError = err => {
      console.error(err)
      this.emitter.emit('error', err)
    }

    const onReady = () => {
      if (++ready === 1) {
        this.emitter.emit('ready')
      }
    }

    const onBind = (
      socket: dgram.Socket,
      interfaceAddr: string,
      isMulticast: boolean
    ) => {
      return () => {
        socket.setMulticastTTL(TTL)
        if (isMulticast) {
          socket.setBroadcast(true)
          if (interfaceAddr) {
            socket.addMembership(this.options.ssdpAddress, adr)
          } else {
            socket.addMembership(this.options.ssdpAddress)
          }
          socket.setMulticastLoopback(true)
        }
        onReady()
      }
    }

    this.socketMap[adr] = {
      unicast: null,
      multicast: null
    }

    const unicastSocket = dgram.createSocket({
      type: this.options.family === 'IPv6' ? 'udp6' : 'udp4',
      reuseAddr: true
    })

    unicastSocket.on('message', onMessage)
    unicastSocket.on('listening', onListening)
    unicastSocket.on('error', onError)
    unicastSocket.on('close', onClose)
    unicastSocket.bind(
      50000 + Math.floor(Math.random() * 1000),
      adr,
      onBind(unicastSocket, adr, false)
    )

    this.socketMap[adr].unicast = unicastSocket
    const multicastSocket = dgram.createSocket({
      type: this.options.family === 'IPv6' ? 'udp6' : 'udp4',
      reuseAddr: true
    })

    multicastSocket.on('message', onMessage)
    multicastSocket.on('listening', onListening)
    multicastSocket.on('error', onError)
    multicastSocket.on('close', onClose)
    multicastSocket.bind(SSDP_PORT, onBind(multicastSocket, adr, true))

    this.socketMap[adr].multicast = multicastSocket
  }
}

type SendArgs = {
  msg: string | any[] | Uint8Array
  port?: number
  address?: string
  callback?: (error: Error, bytes: number) => void
}

type SocketToArgsFn = (key: string) => SendArgs

class UnicastSocketGroup {
  socketManager: SocketManager

  constructor(socketManager: SocketManager) {
    this.socketManager = socketManager
  }

  close() {
    const { socketMap } = this.socketManager
    Object.keys(socketMap).forEach(key => {
      if (socketMap[key].unicast) {
        socketMap[key].unicast.close()
        delete socketMap[key].unicast
      }
    })
  }

  send(options: SendArgs | SocketToArgsFn) {
    const { socketMap } = this.socketManager

    Object.keys(socketMap).forEach(key => {
      if (socketMap[key].unicast) {
        const sendArgs = typeof options === 'function' ? options(key) : options
        socketMap[key].unicast.send(
          sendArgs.msg,
          sendArgs.port,
          sendArgs.address,
          sendArgs.callback
        )
      }
    })
  }
}

class MulitcastSocketGroup {
  socketManager: SocketManager

  constructor(socketManager: SocketManager) {
    this.socketManager = socketManager
  }

  close() {
    const { socketMap } = this.socketManager
    Object.keys(socketMap).forEach(key => {
      if (socketMap[key].multicast) {
        socketMap[key].multicast.close()
        delete socketMap[key].multicast
      }
    })
  }

  send(options: SendArgs | SocketToArgsFn) {
    const { socketMap } = this.socketManager
    Object.keys(socketMap).forEach(key => {
      if (socketMap[key].multicast) {
        const sendArgs = typeof options === 'function' ? options(key) : options
        socketMap[key].multicast.send(
          sendArgs.msg,
          sendArgs.port,
          sendArgs.address,
          sendArgs.callback
        )
      }
    })
  }
}

function serialize(
  head: string,
  headers: SsdpHeaders,
  networkInterfaceAddress?: string
) {
  let result = `${head}\r\n`

  Object.keys(headers).forEach(header => {
    result += `${header}: ${headers[header]}\r\n`
  })
  result += '\r\n'
  if (networkInterfaceAddress) {
    result = result.replace(
      /{{networkInterfaceAddress}}/g,
      networkInterfaceAddress
    )
  }

  return result
}

function deserialize(msg: Buffer) {
  const lines = msg.toString().split('\r\n')
  const line = lines.shift()
  const headers: SsdpHeaders = {} as SsdpHeaders
  let type: 'found' | 'search' | 'notify' | null = null
  if (line.match(/HTTP\/(\d{1})\.(\d{1}) (\d+) (.*)/)) {
    type = 'found'
  } else {
    const t = line.split(' ')[0]
    type = t === TYPE_M_SEARCH ? 'search' : t === TYPE_NOTIFY ? 'notify' : null
  }
  lines.forEach(line => {
    if (line.length) {
      const vv = line.match(/^([^:]+):\s*(.*)$/)
      if (vv && vv.length === 3) {
        // eslint-disable-next-line prefer-destructuring
        headers[vv[1].toUpperCase()] = vv[2]
      }
    }
  })
  return {
    type,
    headers
  }
}

export function createSocket(options?: Partial<SsdpSocketOptions>) {
  const peer = new SsdpSocket(options)
  return peer
}

function eventTimeout<T>(
  ms: number,
  emitter: events.EventEmitter,
  event: string
) {
  let cleanup: () => void

  const promise = new Promise<any>((resolve, reject) => {
    const listener = (...args) => {
      resolve(args)
    }
    console.log('eventTimeout set')
    emitter.once(event, listener)
    cleanup = () => {
      emitter.off(event, listener)
    }
  })

  // Create a promise that rejects in <ms> milliseconds
  const timeout = new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id)
      cleanup()
      reject(new Error(`Timed out in ${ms}ms.`))
    }, ms)
  })

  // Returns a race between our timeout and the passed in promise
  return Promise.race([promise, timeout])
}

function promiseTimeout<T>(ms: number, promise: Promise<T>): Promise<T> {
  const timeout = new Promise<T>((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id)
      reject(new Error(`Timed out in ${ms}ms.`))
    }, ms)
  })

  return Promise.race([promise, timeout])
}
