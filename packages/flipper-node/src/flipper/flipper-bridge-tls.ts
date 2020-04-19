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

type Status = 'not-connected' | 'connecting' | 'connected'

class FlipperBridgeTls implements FlipperBridge {
  protected rsocket: ReactiveSocket<string, string>

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

    this.meta = {
      app: 'Karla Simulator',
      os: { darwin: 'MacOS', win32: 'Windows' }[process.platform] || 'MacOS', // must be MacOS or windows for flipper to process CSR
      device: 'desktop',
      device_id: guid(),
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
    await this.connect()
  }

  public stop(): void {
    try {
      this.rsocket.close()
    } catch (ex) {
      /**  noop * */
    }
    this.flipperClient = null
    this.rsocket = null
  }

  protected async connect(): Promise<void> {
    this.setStatus('connecting')

    const { deviceCsr, deviceKey } = await generateCsr()
    const { destination } = await getDeviceSharedFolder()

    const untrustedRSocket = await backOff(
      () => {
        const transport = new RSocketTcpClient({
          host: 'localhost',
          port: 8089
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

        return asyncSubscribe(untrustedRSocketClient.connect())
      },
      {
        numOfAttempts: Number.POSITIVE_INFINITY,
        startingDelay: 2000,
        maxDelay: 30000,
        retry: (e: any, attemptNumber: number) => {
          console.debug(`connecting to Sonar Flipper [${attemptNumber}]`)
          return true
        }
      }
    )

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

    const socket = new net.Socket()

    socket.on('close', () => {
      this.reset()
    })

    const netSocketOptions = { host: 'localhost', port: 8088 }

    const tlsSocketOptions = {
      ca: caCert,
      cert: deviceCert,
      key: deviceKey,
      socket
    }

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
        console.error(err)
        this.reset()
      }
    })

    this.rsocket = await asyncSubscribe(secureRSocketClient.connect())

    this.setStatus('connected')
    console.debug('Flipper Sonar SDK Connected to Desktop')
  }

  reset() {
    process.nextTick(() => {
      this.rsocket = null
      this.start()
    })
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
