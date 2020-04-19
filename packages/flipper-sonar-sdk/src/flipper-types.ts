/**
 * Copyright Sync Health Labs 2020
 * Portions Copyright (c) Facebook, Inc. and its affiliates.
 */
import { Payload } from 'rsocket-types'
import { Single } from 'rsocket-flowable'

/**
 * A FlipperPlugin is an object which exposes an API to the Desktop Flipper application. When a
 * connection is established the plugin is given a FlipperConnection on which it can register
 * request handlers and send messages. When the FlipperConnection is invalid onDisconnect is called.
 * onConnect may be called again on the same plugin object if Flipper re-connects, this will provide
 * a new FlipperConnection, do not attempt to re-use the previous connection.
 */
export interface FlipperPlugin {
  /**
   * @return The id of this plugin. This is the namespace which Flipper desktop plugins will call
   *     methods on to route them to your plugin. This should match the id specified in your React
   *     plugin.
   */
  readonly id: string

  /**
   * Called when a connection has been established. The connection passed to this method is valid
   * until {@link FlipperPlugin#onDisconnect()} is called.
   */
  onConnect(connection: FlipperConnection): void

  /**
   * Called when the connection passed to `FlipperPlugin#onConnect(FlipperConnection)` is no
   * longer valid. Do not try to use the connection in or after this method has been called.
   */
  onDisconnect(): void

  /**
   * Returns true if the plugin is meant to be run in background too, otherwise it returns false.
   */
  runInBackground(): boolean

  /**
   * Indicates the schema and version of this plugin
   */
  schema?: 'https://schemas.iopa.io/flipper/sonar/1.0'
}

/**
 * FlipperResponder is used to asyncronously response to a messaged recieved from the Flipper
 * desktop app. The Flipper Responder will automatically wrap the response in an approriate object
 * depending on if it is an error or not.
 */
export interface FlipperResponder {
  success(response?: any): void
  error(response: any): void
}

export interface FlipperIopaRequest {
  'iopa.Method': string
  'iopa.Body': any
}

export interface FlipperIopaContext extends FlipperIopaRequest {
  response: FlipperResponder
}

/**
 * A connection between a FlipperPlugin and the desktop Flipper application. Register request
 * handlers to respond to calls made by the desktop application or directly send messages to the
 * desktop application.
 */
export interface FlipperConnection {
  /** Deprecated, use fetch instead which allows for error tracking */
  send(method: string, data: any): void
  send(request: FlipperIopaRequest): void

  /** Call a method on your desktop plugin implementation. Call .catch() on the returned
   * promise to handle any errors returned from the client. */
  fetch<D, R>(method: string, data: D): Promise<R>
  fetch<D, R>(request: FlipperIopaRequest): Promise<R>

  /** Subscibe to messages for method, modern IOPA api */
  on(method: string, listener: (context: FlipperIopaContext) => void): void

  /** Subscibe to messages for method, compatible with react-native API */
  receive(
    method: string,
    listener: (body: any, responder: FlipperResponder) => void
  ): void

  listeners: Map<string, (context: FlipperIopaContext) => void>
}

/*
 *  All the actual RSocket Transport logic and certificate exchange
 * is encapsulated in FlipperBridge
 */
export interface FlipperBridge {
  readonly client: FlipperClient
  fireAndForget(payload: Payload<string, string>): void

  requestResponse(
    payload: Payload<string, string>
  ): Single<Payload<string, string>>

  start(): Promise<void>
  stop(): void
}

/**
 * Internal api to connect to the Desktop module, not for general use;
 * Every plugin gets a FlipperConnection / FlipperIopaConnection and every inbound method
 * gets a Flipper Responder
 */
export interface FlipperClient {
  //
  // Life Cycle Properties and Methods
  //
  addPlugin(plugin: FlipperPlugin): void

  getPlugin(id: string): FlipperPlugin | null

  removePlugin(plugin: FlipperPlugin): void

  start(): void

  stop(): void

  //
  // Inbound Helpers for interacting with FlipperBridge
  //

  bridge: FlipperBridge

  onRequestResponse(
    payload: Payload<string, any>
  ): Single<Payload<string, string>>

  onFireForget(payload: Payload<string, any>): void
}
