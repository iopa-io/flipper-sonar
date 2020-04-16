/* eslint-disable @typescript-eslint/camelcase */
import { RSocketClient } from 'rsocket-core'

import RSocketTcpClient from 'rsocket-tcp-client'
import { RSocketTlsClient } from 'rsocket-tcp-client/build/RSocketTcpClient'

import { ReactiveSocket, Payload } from 'rsocket-types'
import { Single } from 'rsocket-flowable'
import { backOff } from 'exponential-backoff'
import { generateCsr, getDeviceSharedFolder, getDeviceFiles } from '../ssl'

import { FlipperBridge, FlipperClient as IFlipperClient } from './flipper-types'
import FlipperClient from './flipper-client'
import { asyncSubscribe, asyncRequestResponse } from '../util/async-rsocket'
import guid from '../util/guid'

class FlipperBridgeImpl implements FlipperBridge {
  protected rsocket: ReactiveSocket<string, string>

  protected flipperClient: IFlipperClient

  protected id: string

  public isReady: Promise<void>

  public get client() {
    return this.flipperClient
  }

  constructor() {
    this.flipperClient = new FlipperClient(this)
  }

  public fireAndForget(payload: Payload<string, string>): void {
    if (this.rsocket) {
      this.rsocket.fireAndForget(payload)
    }
  }

  public requestResponse(
    payload: Payload<string, string>
  ): Single<Payload<string, string>> {
    if (this.rsocket) {
      return this.rsocket.requestResponse(payload)
    }
    return null
  }

  public async start(): Promise<void> {
    this.isReady = this.init()
    await this.isReady
  }

  public stop(): void {
    this.rsocket.close()
    this.flipperClient = null
    this.rsocket = null
  }

  protected async init(): Promise<void> {
    this.id = guid()

    const id = {
      app: 'Karla Simulator',
      os: 'MacOS', // must be MacOS or windows for flipper to process CSR
      device: 'desktop',
      device_id: this.id,
      sdk_version: 3
    }

    const { deviceCsr, deviceKey } = await generateCsr()
    const { destination } = await getDeviceSharedFolder()

    let untrustedRSocket

    try {
      untrustedRSocket = await backOff(
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
              payload: { data: JSON.stringify(id), metadata: null }
            },
            transport
          })

          return asyncSubscribe(untrustedRSocketClient.connect())
        },
        {
          numOfAttempts: 10,
          retry: (e: any, attemptNumber: number) => {
            console.log(attemptNumber, e)
            return true
          }
        }
      )
    } catch (ex) {
      return new Promise(() => {
        /** never finish */
      })
    }
    console.log('got socket')

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

    const tlsSocketOptions = {
      ca: caCert,
      cert: deviceCert,
      key: deviceKey,
      host: 'localhost',
      port: 8088
    }

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
          data: JSON.stringify({ ...id, device_id: '', foreground: true }),
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
      }
    })

    this.rsocket = await asyncSubscribe(secureRSocketClient.connect())
    return null
  }
}

const bridge = new FlipperBridgeImpl()
const { client } = bridge
const { addPlugin } = client
export { addPlugin }
export default client
