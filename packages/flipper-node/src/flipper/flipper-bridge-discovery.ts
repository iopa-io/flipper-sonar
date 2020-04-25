import {
  createSocket as createSsdp,
  SsdpSocket,
  SONAR_DESKTOP_TYPE
} from 'flipper-ssdp'

const QUERY_INTERVAL = 5000

interface DiscoveryResult {
  deviceId: string
  deviceType: string
  addresses:
    | Record<string, { port: number; host: string; family: string }>
    | undefined
}

export default class DiscoveryWatcher {
  protected ssdp: SsdpSocket

  protected deviceId: string

  protected desktopId: string | undefined

  protected isSearching: boolean

  constructor(deviceId: string) {
    this.deviceId = deviceId
    this.startDiscoveryWatcher()
  }

  private startDiscoveryWatcher(): Promise<void> {
    const ssdp = createSsdp()
    this.ssdp = ssdp

    const isReady = new Promise<void>((resolve, _) => {
      ssdp.on('ready', () => {
        resolve()
      })
    })

    ssdp.start()

    return isReady
  }

  private async searchAndListen(): Promise<DiscoveryResult> {
    const announcementsPromise = this.ssdp.getAnnounceFirst(
      {
        NT: SONAR_DESKTOP_TYPE
      },
      QUERY_INTERVAL
    )

    const searchPromise = this.ssdp.searchFirst(
      {
        ST: SONAR_DESKTOP_TYPE
      },
      QUERY_INTERVAL
    )

    const results = await Promise.race([announcementsPromise, searchPromise])

    return {
      deviceId: results[0].USN || SONAR_DESKTOP_TYPE,
      deviceType: results[0].ST || results[0].NT || SONAR_DESKTOP_TYPE,
      addresses: results[0].AL ? JSON.parse(results[0].AL) : undefined
    }
  }

  async findDesktopSonar(): Promise<DiscoveryResult> {
    let result: DiscoveryResult

    this.isSearching = true

    while (!result && this.isSearching) {
      try {
        // eslint-disable-next-line no-await-in-loop
        result = await this.searchAndListen()
      } catch (ex) {
        /* noop */
      }
    }

    return result
  }

  cancelFind() {
    this.isSearching = false
  }
}
