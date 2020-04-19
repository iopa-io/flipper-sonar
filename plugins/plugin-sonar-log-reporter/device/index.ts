import { FlipperPlugin, FlipperConnection } from 'flipper-node'

import {
  getArrayWithLimitedLength,
  addOptionalArrayToObject
} from 'flipper-sonar-util'
import { FlipperIopaContext } from 'flipper-sonar-sdk'
import { name as packageName } from '../package.json'
import { LogRecord } from '../desktop/model'

let counter = 1

class CustomPluginOnDevice implements FlipperPlugin {
  id: string = packageName

  schema: 'https://schemas.iopa.io/flipper/sonar/1.0'

  private flipper: FlipperConnection

  cache: LogRecord[] = getArrayWithLimitedLength(100)

  onConnect(flipper: FlipperConnection) {
    this.flipper = flipper

    flipper.on('getCache', async (context: FlipperIopaContext) => {
      context.response.success(
        Object.values(
          this.cache.reduce((accum, item) => {
            accum[item.id] = item
            return accum
          }, {} as Record<string, LogRecord>)
        )
      )
    })
  }

  onDisconnect() {
    this.flipper = null
  }

  runInBackground() {
    return true
  }

  reportLog(logType, message, params) {
    const payload = addOptionalArrayToObject(
      {
        id: `${counter++}`,
        logType,
        timeStamp: new Date().toISOString(),
        message
      },
      params
    ) as LogRecord

    this.cache.push(payload)
    this.flipper.send('log', payload)
  }

  verbose(message, ...params) {
    this.reportLog('verbose', message, params)
  }

  debug(message, ...params) {
    this.reportLog('debug', message, params)
  }

  info(message, ...params) {
    this.reportLog('info', message, params)
  }

  log(message, ...params) {
    this.reportLog('info', message, params)
  }

  warn(message, ...params) {
    this.reportLog('warn', message, params)
  }

  error(message, ...params) {
    this.reportLog('error', message, params)
  }

  fatal(message, ...params) {
    this.reportLog('fatal', message, params)
  }
}

const pluginInstance = new CustomPluginOnDevice()

export default pluginInstance
