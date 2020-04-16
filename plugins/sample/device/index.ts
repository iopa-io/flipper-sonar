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

const sample = new Sample()
export default sample
