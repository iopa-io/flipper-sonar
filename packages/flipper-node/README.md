# Flipper Node

> Flipper for Node and Electron

This is the Custom Flipper Client SDK for Node and Electron based applications. 

Flipper (aka Sonar) is an excellent platform for debugging mobile/desktop apps on iOS, Android (original Flipper SDK), Electron and Node.js (with Sync Sonar SDK for Electron and Node).   

Visualize, inspect, and control your apps from a simple desktop interface.    It's even included as standard in all recent React Native apps.

### Motivation

Flipper is easily extensible using the plugin API, but does not come with any custom clients for some of the most popular server and desktop ecosystems, and yet is ideal for instrumenting these apps too.

## flipper-node

### Add flipper-node to your project

``` js
yarn add flipper-node --save
```

### Add plugins to your Flipper App installion

``` json
{"pluginPaths":["~/projects/flipper-sonar/plugins"]}
```

### Add to your node App or electron main process

``` js
import sonarCrashReporter from 'flipper-plugin-sonar-crash-reporter/device'
import sonarLogger from 'flipper-plugin-sonar-log-reporter/device'
// your plugins here
import sample from 'flipper-plugin-sonar-sample/device'

import client from 'flipper-node'

async function init() {
  // always include the sonar logger and sonar crashReporter as the default device 
  // plugins in Flipper are iOS and Android only
  client.addPlugin(sonarLogger)
  client.addPlugin(sonarCrashReporter)
  // your plugins here
  client.addPlugin(sample)
  client.start()
  await client.isReady
  console.log('NODE CLIENT READY READY')
  sonarLogger.log('HELLO WORLD')
  setTimeout(
    _ =>
      sonarCrashReporter.report({
        name: 'test',
        message: 'test2'
      }),
    5000
  )

  setTimeout(_ => sonarLogger.log('this is another log message'), 4000)
}

init()
```

## Custom Plugin API (on Device)

Plugins should implement `FlipperPlugin` and are given a `FlipperConnection` upon connection.   The API is very similar to `react-native` and other Flipper clients.

``` js
import { FlipperPlugin, FlipperConnection } from 'flipper-node'

class Sample implements FlipperPlugin {
  public id = 'flipper-plugin-sonar-sample'

  private connection: FlipperConnection

  onConnect(connection: FlipperConnection) {
    this.connection = connection
  }

  onDisconnect() {
    this.connection = null
  }

  runInBackground() {
    return false
  }

  async log(text) {
    if (this.connection) {
      console.log('SENT', { message: text })
      this.connection.send('log', { message: text })
    }
  }
}
```

For the desktop side of the plugin, just use the vanilla Flipper Desktop (JS) API.   See [`flipper-hooks`](https://www.npmjs.com/package/flipper-hooks) for a lighter weight React Hooks based API by the same authors as this package.

## Common problems

Flipper, and its embedded Facebook Metro bundler, does not always work well with mono repositories and yarn workspaces that use symlinking.

### View compilation progress/errors

To see the compilation errors for your custom plugins, run Flipper (production edition) from the command line

``` bash
/Applications/Flipper.app/Contents/MacOS/Flipper
```

### SHA1 error
If you get an SHA1 error upon compilation, its likely due to the symlink issue.

Change `Applications/Flipper.app/Contents/Resources/app/node_modules/metro/src/node-haste/DependencyGraph.js#getSHA1` to include:

``` js
  if (!sha1) {
      return getFileHash(resolvedPath)
      function getFileHash(file) {
        return require('crypto')
          .createHash('sha1')
          .update(fs.readFileSync(file))
          .digest('hex')
      }
    }
```

### See Crash Logs immediately

Flipper only shows plugin updates and notifications when that plugin is in the foreground, unless there is hard coded device-specific logic in the Flipper App (which there is for iOS and Android logs).   We've implemented the logs and crash reports using a more vanilla plugin that uses the standard device-desktop rsocket protocol, and so if you want to get the notifications immediately you need to change one line in the Flipper App.

Change `Applications/Flipper.app/Contents/Resources/app/src/utils/messageQueue.tsx` to add the plugins to the immediate processing queue

``` js
switch (true) {
    case plugin.id === 'flipper-plugin-sonar-crash-reporter' ||
      plugin.id === 'Navigation': // Navigation events are always processed, to make sure the navbar stays up to date
```

### Flipper App

Please note the above changes are in your Flipper electron-based desktop app, and so either need to be done in a custom fork, or every time you download and update the Flipper App. 

## License

MIT
