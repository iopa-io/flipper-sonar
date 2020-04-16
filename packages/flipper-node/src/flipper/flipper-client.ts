/**
 * Copyright Sync Health Labs 2020
 * Portions Copyright 2018-present Facebook.
 */
import { Single } from 'rsocket-flowable'
import { Payload } from 'rsocket-types'
import { IFutureSubject } from 'rsocket-flowable/Single'
import {
  FlipperBridge,
  FlipperClient,
  FlipperConnection,
  FlipperPlugin,
  FlipperResponder
} from './flipper-types'
import { asyncSubscribe } from '../util/async-rsocket'

class FlipperClientConnection implements FlipperConnection {
  private bridge: FlipperBridge

  private pluginId: string

  public listeners: Map<
    string,
    (params: any, responder: FlipperResponder) => void
  > = new Map()

  constructor(id: string, bridge: FlipperBridge) {
    this.bridge = bridge
    this.pluginId = id
  }

  send<D>(method: string, params: D) {
    this.bridge.fireAndForget({
      data: JSON.stringify({
        method: 'execute',
        params: {
          api: this.pluginId,
          method,
          params
        }
      })
    })
  }

  async fetch<D, R>(method: string, params: D): Promise<R> {
    const response = await asyncSubscribe(
      this.bridge.requestResponse({
        data: JSON.stringify({
          method: 'execute',
          params: {
            api: this.pluginId,
            method,
            params
          }
        })
      })
    )

    return JSON.parse(response.data)
  }

  on(
    method: string,
    listener: (params: any, responder: FlipperResponder) => void
  ) {
    this.listeners.set(method, listener)
  }
}

class FlipperClientResponder implements FlipperResponder {
  single: Single<Payload<string, string>>

  subscriber: IFutureSubject<Payload<string, string>>

  isReady: Promise<void>

  bridge: FlipperBridge

  constructor(bridge: FlipperBridge) {
    this.bridge = bridge
    this.isReady = new Promise<void>(resolve => {
      this.single = new Single<Payload<string, string>>(subscriber => {
        this.subscriber = subscriber
        subscriber.onSubscribe(() => {
          /** noop */
        })
        resolve()
      })
    })
  }

  async success(data) {
    await this.isReady
    this.subscriber.onComplete({
      data: JSON.stringify(data)
    })
    this.subscriber = undefined
    this.single = undefined
  }

  async error({ message, name }) {
    await this.isReady
    this.subscriber.onComplete({
      data: JSON.stringify({
        error: { message, name }
      })
    })
    this.subscriber = undefined
    this.single = undefined
  }
}

class FlipperErrorResponder implements FlipperResponder {
  bridge: FlipperBridge

  isReady: Promise<void>

  constructor(bridge: FlipperBridge) {
    this.bridge = bridge
  }

  public success = null

  async error({ message, name }) {
    this.bridge.fireAndForget({
      data: JSON.stringify({
        method: 'execute',
        parmas: {
          api: 'flipper-plugin-sonar-crash-reporter',
          method: 'crash-report',
          params: {
            message,
            name
          }
        }
      })
    })
  }
}

export default class FlipperDeviceClient implements FlipperClient {
  bridge: FlipperBridge

  get isReady(): Promise<void> {
    return this.bridge.isReady
  }

  plugins: Map<string, FlipperPlugin> = new Map()

  connections: Map<string, FlipperConnection> = new Map()

  constructor(bridge: FlipperBridge) {
    this.bridge = bridge
  }

  public addPlugin(plugin: FlipperPlugin) {
    this.plugins.set(plugin.id, plugin)
  }

  public getPlugin(id: string): FlipperPlugin | null {
    return this.plugins.get(id)
  }

  public removePlugin(plugin: FlipperPlugin): void {
    this.plugins.delete(plugin.id)
  }

  public start() {
    this.bridge.start()
    this.plugins.forEach((plugin, id) => {
      if (plugin.runInBackground()) {
        const connection = new FlipperClientConnection(id, this.bridge)
        this.connections.set(id, connection)
        plugin.onConnect(connection)
      }
    })
  }

  public stop() {
    this.plugins.forEach((plugin, id) => {
      if (plugin.runInBackground()) {
        plugin.onDisconnect()
      }
    })
    this.bridge.stop()
    this.connections.clear()
  }

  public onRequestResponse = (payload: Payload<string, any>) => {
    const data =
      payload.data != null
        ? JSON.parse(payload.data)
        : { method: 'not-defined' }

    const { method, params }: { method: string; params?: any } = data

    console.log('Flipper client onRequestResponse', data)

    const responder = new FlipperClientResponder(this.bridge)

    switch (method) {
      case 'getPlugins':
        this.getPlugins(responder)
        break
      case 'execute':
        this.execute(params, responder)
        break
      default:
        responder.success({ success: null })
        break
    }

    return responder.single
  }

  public onFireForget = (payload: Payload<string, any>) => {
    const data =
      payload.data != null
        ? JSON.parse(payload.data)
        : { method: 'not-defined' }

    const { method, params }: { method: string; params?: any } = data

    const errorResponder = new FlipperErrorResponder(this.bridge)

    console.log('Flipper client onFireForget', data)

    switch (method) {
      case 'init':
        this.initPlugin(params, errorResponder)
        break
      case 'deinit':
        this.deinitPlugin(params, errorResponder)
        break
      default:
        console.error(`Got unknown onFireForget method ${method}`)
        errorResponder.error({
          message: `Got unknown onFireForget method ${method}`,
          name: 'UnknownMethod'
        })
        this.onRequestResponse(payload)
        break
    }
  }

  protected getPlugins(responder: FlipperResponder): void {
    responder.success({
      success: {
        plugins: Array.from(this.plugins.keys())
      }
    })
  }

  protected initPlugin(
    {
      plugin: pluginId
    }: {
      plugin: string
    },
    errorResponder: FlipperResponder
  ) {
    if (!pluginId) {
      errorResponder.error({
        message: 'Parameter plugin missing on method init',
        name: 'PluginNotFound'
      })
      return
    }
    if (!this.plugins.has(pluginId)) {
      errorResponder.error({
        message: `Plugin ${pluginId} not found for method init`,
        name: 'PluginNotFound'
      })
      return
    }
    const plugin = this.plugins.get(pluginId)
    if (plugin.runInBackground()) {
      return
    }
    const connection = new FlipperClientConnection(plugin.id, this.bridge)
    this.connections.set(pluginId, connection)
    plugin.onConnect(connection)
  }

  protected deinitPlugin(
    {
      plugin: pluginId
    }: {
      plugin: string
    },
    errorResponder: FlipperResponder
  ) {
    if (!pluginId) {
      errorResponder.error({
        message: 'Parameter plugin missing on method deinit',
        name: 'PluginNotFound'
      })
      return
    }
    if (!this.plugins.has(pluginId)) {
      errorResponder.error({
        message: `Plugin ${pluginId} not found for method deinit`,
        name: 'PluginNotFound'
      })
      return
    }
    const plugin = this.plugins.get(pluginId)
    if (plugin.runInBackground()) {
      return
    }

    plugin.onDisconnect()
    if (this.connections.has(pluginId)) {
      this.connections.delete(pluginId)
    }
  }

  protected execute(
    {
      api: pluginId,
      method,
      params = {}
    }: {
      api: string
      method: string
      params: Record<string, any>
    },
    responder: FlipperResponder
  ): void {
    if (!pluginId) {
      responder.error({
        message: 'Parameter plugin missing on method execute',
        name: 'PluginNotFound'
      })
      return
    }
    if (!this.plugins.has(pluginId)) {
      responder.error({
        message: `Plugin ${pluginId} not found for method execute`,
        name: 'PluginNotFound'
      })
      return
    }
    if (!this.connections.has(pluginId)) {
      responder.error({
        message: `Plugin connection ${pluginId} not found for method execute; make sure init is called first`,
        name: 'PluginConnectionNotFound'
      })
      return
    }

    const { listeners } = this.connections.get(pluginId)

    if (!listeners.has(method)) {
      responder.error({
        message: `Plugin ${pluginId} has not registered method ${method} for execute`,
        name: 'PluginMethodNotFound'
      })
      return
    }

    const receiver = listeners.get(method)
    receiver(params, responder)
  }
}
