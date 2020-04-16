import { FlipperPlugin, FlipperConnection } from 'flipper-node'

class CustomPluginOnDevice implements FlipperPlugin {
  public id = 'flipper-plugin-sonar-crash-reporter'

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
