import { FlipperPlugin, FlipperConnection } from 'flipper-node'

class CustomPluginOnDevice implements FlipperPlugin {
  public id = 'flipper-plugin-sonar-log-reporter'

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

  debug(message, ...rest) {
    this.connection.send('log', {
      logType: 'debug',
      timeStamp: new Date().toISOString(),
      message,
      ...rest
    })
  }

  info(message, ...rest) {
    this.connection.send('log', {
      logType: 'info',
      timeStamp: new Date().toISOString(),
      message,
      ...rest
    })
  }

  notice(message, ...rest) {
    this.connection.send('log', {
      logType: 'notice',
      timeStamp: new Date().toISOString(),
      message,
      ...rest
    })
  }

  log(message, ...rest) {
    this.connection.send('log', {
      logType: 'info',
      timeStamp: new Date().toISOString(),
      message,
      ...rest
    })
  }

  warning(message, ...rest) {
    this.connection.send('log', {
      logType: 'warning',
      timeStamp: new Date().toISOString(),
      message,
      ...rest
    })
  }

  error(message, ...rest) {
    this.connection.send('log', {
      logType: 'error',
      timeStamp: new Date().toISOString(),
      message,
      ...rest
    })
  }

  critical(message, ...rest) {
    this.connection.send('log', {
      logType: 'critical',
      timeStamp: new Date().toISOString(),
      message,
      ...rest
    })
  }
}

const pluginInstance = new CustomPluginOnDevice()

export default pluginInstance
