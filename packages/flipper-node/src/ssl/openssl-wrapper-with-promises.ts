import { exec as opensslWithCallback, Action } from 'openssl-wrapper'
import { spawnSync } from 'child_process'

export function openssl(action: Action, options: {}): Promise<string> {
  return new Promise((resolve, reject) => {
    opensslWithCallback(action, options, (err, buffer) => {
      if (err) {
        reject(err)
      } else if (buffer) {
        resolve(buffer.toString())
      }
    })
  })
}

export function isInstalled(): boolean {
  return !spawnSync('openssl', ['version']).error
}
