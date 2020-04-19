import { FlipperPlugin, FlipperConnection } from 'flipper-node'

import { name as id } from '../package.json'

class CustomPluginOnDevice implements FlipperPlugin {
  public id = id

  private connection: FlipperConnection

  onConnect(connection: FlipperConnection) {
    this.connection = connection
  }

  onDisconnect() {
    this.connection = null
  }

  runInBackground() {
    return true
  }

  report({
    message,
    stack: callstack = '',
    name,
    ...rest
  }: {
    message: string
    stack?: string
    name?: string
  }) {
    this.connection.send('crash-report', {
      reason: message,
      name,
      callstack,
      ...rest
    })
  }
}

const pluginInstance = new CustomPluginOnDevice()

export default pluginInstance
