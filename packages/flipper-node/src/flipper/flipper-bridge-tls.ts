/* eslint-disable @typescript-eslint/camelcase */
import { RSocketClient } from 'rsocket-core'
import RSocketTcpClient from 'rsocket-tcp-client'
import { RSocketTlsClient } from 'rsocket-tcp-client/build/RSocketTcpClient'
import { ReactiveSocket, Payload } from 'rsocket-types'
import { Single } from 'rsocket-flowable'
import { backOff } from 'exponential-backoff'
import * as net from 'net'

import { observable, computed, when, action, decorate } from 'mobx'
import {
  FlipperBridge,
  FlipperClient as IFlipperClient,
  FlipperDeviceClient,
  asyncSubscribe,
  asyncRequestResponse,
  guid
} from 'flipper-sonar-sdk'
import { generateCsr, getDeviceSharedFolder, getDeviceFiles } from '../ssl'
import DiscoveryWatcher from './flipper-bridge-discovery'

type Status = 'not-connected' | 'discovering' | 'connecting' | 'connected'

const DESKTOP_ATTEMPTS = new Map<string, number>()

class FlipperBridgeTls implements FlipperBridge {
  protected readonly deviceId = `uuid:${guid()}`

  protected readonly deviceType = `urn:io.iopa:device:sonar:3.0`

  protected rsocket: ReactiveSocket<string, string>

  protected discovery: DiscoveryWatcher

  protected flipperClient: IFlipperClient

  status: Status

  get isReady() {
    return when(() => this.status === 'connected')
  }

  get isConnected() {
    return this.status === 'connected'
  }

  setStatus(status: Status) {
    this.status = status
  }

  protected meta: {
    app: string
    os: string
    device: string
    device_id: string
    sdk_version: number
  }

  public get client() {
    return this.flipperClient
  }

  constructor() {
    this.status = 'not-connected'

    this.flipperClient = new FlipperDeviceClient(this)

    this.discovery = new DiscoveryWatcher(this.deviceId)

    this.meta = {
      app: 'Karla Simulator',
      os: { darwin: 'MacOS', win32: 'Windows' }[process.platform] || 'MacOS', // must be MacOS or windows for flipper to process CSR
      device: 'desktop',
      device_id: this.deviceId,
      sdk_version: 3
    }
  }

  public fireAndForget(payload: Payload<string, string>): void {
    if (this.isConnected) {
      this.rsocket.fireAndForget(payload)
    }
  }

  public requestResponse(
    payload: Payload<string, string>
  ): Single<Payload<string, string>> {
    if (this.isConnected) {
      return this.rsocket.requestResponse(payload)
    }
    return null
  }

  public start = async () => {
    console.debug(`Searching for Sync SONAR Desktop`)
    this.setStatus('discovering')

    const sonarDesktop = await this.discovery.findDesktopSonar()
    if (!sonarDesktop) {
      return
    }

    await this.connect(sonarDesktop.deviceId, sonarDesktop.addresses)
  }

  public stop(): void {
    this.discovery.cancelFind()
    try {
      this.rsocket.close()
    } catch (ex) {
      /**  noop * */
    }
    this.flipperClient = null
    this.rsocket = null
  }

  protected async connect(
    bridgeId: string,
    addresses: Record<string, { host: string; port: number }>
  ): Promise<void> {
    DESKTOP_ATTEMPTS[addresses.secure.host] =
      (DESKTOP_ATTEMPTS[addresses.secure.host] || 0) + 1

    if (DESKTOP_ATTEMPTS[addresses.secure.host] > 5) {
      return
    }

    if (DESKTOP_ATTEMPTS[addresses.secure.host] === 5) {
      console.error(
        `Maximum number of attempts to Sync SONAR desktop at address ${addresses.secure.host}`
      )
      return
    }

    this.setStatus('connecting')
    console.debug(`Connecting to Sync SONAR Desktop ${bridgeId}`)

    const { deviceCsr, deviceKey } = await generateCsr()
    const { destination } = await getDeviceSharedFolder()

    let untrustedRSocket: ReactiveSocket<string, any>

    try {
      untrustedRSocket = await backOff(
        () => {
          const transport = new RSocketTcpClient({
            host: addresses.insecure.host || 'localhost',
            port: addresses.insecure.port || 8089
          })

          const untrustedRSocketClient = new RSocketClient({
            // note: default `serializers` is pass-through
            setup: {
              // ms btw sending keepalive to server
              keepAlive: 60000,
              // ms timeout if no keepalive response
              lifetime: 180000,
              dataMimeType: 'application/json',
              metadataMimeType: 'application/json',
              payload: { data: JSON.stringify(this.meta), metadata: null }
            },
            transport
          })

          try {
            return asyncSubscribe(untrustedRSocketClient.connect())
          } catch (ex) {
            this.reset()
          }
        },
        {
          // 0, 200, 400, 800, 1000
          numOfAttempts: 5,
          startingDelay: 200,
          maxDelay: 1000,
          timeMultiple: 2,
          retry: (e: any, attemptNumber: number) => {
            console.debug(
              `Reattempting connection to Sync SONAR Desktop Certificate Channel [${attemptNumber}]`
            )
            return true
          }
        }
      )
    } catch (ex) {
      this.reset()
      return
    }

    const untrustedPayload = await asyncRequestResponse(
      untrustedRSocket,
      JSON.stringify({
        method: 'signCertificate',
        csr: deviceCsr,
        destination
      })
    )

    const { data } = untrustedPayload

    const { caCert, deviceCert } = await getDeviceFiles(destination)

    //  untrustedRSocket.close()

    console.debug(`Received secure certificates from Sync SONAR Desktop`)

    const netSocketOptions = {
      host: addresses.secure.host || 'localhost',
      port: addresses.secure.port || 8088
    }

    try {
      this.rsocket = await backOff(
        () =>
          new Promise((resolve, reject) => {
            const socket = new net.Socket()

            const tlsSocketOptions = {
              ca: caCert,
              cert: deviceCert,
              key: deviceKey,
              socket
            }

            socket.on('error', er => {
              console.log('-----ERROR-----', er)
              reject(er)
            })

            socket.on('close', () => {
              this.reset()
            })

            socket.connect(netSocketOptions)

            const secureRSocketClient = new RSocketClient({
              // note: default `serializers` is pass-through
              setup: {
                // ms btw sending keepalive to server
                keepAlive: 60000,
                // ms timeout if no keepalive response
                lifetime: 180000,
                dataMimeType: 'application/json',
                metadataMimeType: 'application/json',
                payload: {
                  data: JSON.stringify({
                    ...this.meta,
                    device_id: '',
                    foreground: true
                  }),
                  metadata: null
                }
              },
              transport: new RSocketTlsClient(tlsSocketOptions),
              responder: {
                fireAndForget: this.flipperClient.onFireForget,
                requestResponse: this.flipperClient.onRequestResponse
              },
              errorHandler: err => {
                console.error('errorHandler', err)
                this.reset()
              }
            })

            try {
              resolve(asyncSubscribe(secureRSocketClient.connect()))
            } catch (err) {
              console.error('asyncSubscribe', err)
              this.reset()
            }
          }),
        {
          // Try at 0, +1000, +2000, +3000ms  then move back to discovery
          numOfAttempts: 3,
          timeMultiple: 2,
          startingDelay: 1000,
          maxDelay: 3000,
          retry: (e: any, attemptNumber: number) => {
            console.debug(
              `Reattempting connection to Secure SONAR Desktop [${attemptNumber}]`
            )
            return true
          }
        }
      )
    } catch (ex) {
      this.reset()
      return
    }

    this.setStatus('connected')
    console.debug('Connected to Sync SONAR Desktop')
    DESKTOP_ATTEMPTS[addresses.secure.host] = 0
  }

  reset() {
    console.debug(`Disconnected from Sync SONAR Desktop`)
    setTimeout(() => {
      this.rsocket = null
      this.start()
    }, 500)
  }
}

decorate(FlipperBridgeTls, {
  status: observable,
  isConnected: computed,
  setStatus: action
})

const bridge = new FlipperBridgeTls()
const { client } = bridge
const { addPlugin } = client
export { addPlugin }
export default client
