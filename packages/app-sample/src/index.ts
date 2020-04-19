/* eslint-disable import/no-named-default */
import sonarCrashReporter from 'flipper-plugin-sonar-crash-reporter/device/index'
import sonarLogger from 'flipper-plugin-sonar-log-reporter/device/index'

import client from 'flipper-node'

async function init() {
  client.addPlugin(sonarLogger)
  client.addPlugin(sonarCrashReporter)
  await client.start()
  sonarLogger.log('HELLO WORLD')
  setTimeout(
    _ =>
      sonarCrashReporter.report({
        name: 'test',
        message: 'test2'
      }),
    5000
  )

  setTimeout(_ => sonarLogger.log('this is a log message'), 4000)
}

init()
