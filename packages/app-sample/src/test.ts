/* eslint-disable @typescript-eslint/camelcase */

import * as tls from 'tls'
import * as net from 'net'
import {
  generateCsr,
  generateCACert,
  generateServerCert,
  getDeviceSharedFolder,
  generateClientCertificate,
  writeDeviceFiles,
  getDeviceFiles
} from './csr'

let serverSrl: string

async function init() {
  //
  // SET UP SERVER
  //

  const { caCert, caKey } = await generateCACert()

  const { serverCert, serverKey, serverSerial } = await generateServerCert(
    caKey,
    caCert
  )

  serverSrl = serverSerial

  const unsecured_server = net.createServer(socket => {
    socket.on('data', async raw => {
      const data = JSON.parse(raw.toString('utf8'))
      const { csr, destination } = data
      const {
        deviceCert,
        serverSrl: serverSerial
      } = await generateClientCertificate(csr, caCert, caKey, serverSrl)
      serverSrl = serverSerial
      await writeDeviceFiles(destination, deviceCert, caCert)

      socket.write(JSON.stringify({ deviceId: '' }))
    })
  })

  const secured_server = tls.createServer(
    {
      ca: caCert,
      cert: serverCert,
      key: serverKey,
      rejectUnauthorized: true,
      requestCert: true
    },
    socket => {
      socket.on('data', async raw => {
        const data = JSON.parse(raw.toString('utf8'))
        console.log(data)
        socket.destroy()
        process.exit(1)
      })
    }
  )

  unsecured_server.listen({
    host: 'localhost',
    port: 8089,
    exclusive: true
  })

  secured_server.listen({
    host: 'localhost',
    port: 8088,
    exclusive: true
  })

  //
  // INITIATE CLIENT
  //

  const id = {
    app: 'Karla',
    os: 'MacOS', // must be MacOS or windows for flipper to process CSR
    device: 'desktop',
    device_id: guid(),
    sdk_version: 3
  }

  const { deviceCsr, deviceKey } = await generateCsr()
  const { destination } = await getDeviceSharedFolder()

  const socket = net.createConnection({ host: 'localhost', port: 8089 })

  socket.on('data', async raw => {
    const data = JSON.parse(raw.toString('utf8'))
    console.log('DEVICE', data)
    const { deviceId } = data
    const files = await getDeviceFiles(destination)
    const { deviceCert, caCert: deviceCaCert } = files

    console.log('DEVICE', 'got cert', deviceCert)
    socket.destroy()

    const socket2 = tls.connect(
      {
        ca: deviceCaCert,
        cert: deviceCert,
        key: deviceKey,
        host: 'localhost',
        port: 8088
      },
      () => {
        console.log('DEVICE', 'secure client connected')
        socket2.write(JSON.stringify(id))
      }
    )
  })

  socket.write(JSON.stringify({ csr: deviceCsr, destination }))
}

try {
  init()
} catch (ex) {
  console.error(ex)
}

/** Create a new guid */
export default function guid() {
  return `${s4() + s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`
}

/** Helper function to create a new 4 character ID (random) */
function s4() {
  return Math.floor((1 + Math.random()) * 0x10000)
    .toString(16)
    .substring(1)
}
