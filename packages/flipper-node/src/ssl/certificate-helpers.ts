/* eslint-disable no-async-promise-executor */
import * as fs from 'fs-extra'
import * as path from 'path'
import { promisify } from 'util'
import { dir, file, DirOptions, FileOptions } from 'tmp'
import {
  openssl,
  isInstalled as opensslInstalled
} from './openssl-wrapper-with-promises'

const tmpFile = promisify(file) as (options?: FileOptions) => Promise<string>
const tmpDir = promisify(dir) as (options?: DirOptions) => Promise<string>

const deviceCertFile = 'device.crt'
const deviceKeyFile = 'device.key'
const deviceCsrFile = 'device.csr'

const caKeyFile = `sonarCA.key`
const caCertFile = 'sonarCA.crt'
const serverKeyFile = 'server.key'
const serverCsrFile = 'server.csr'
const serverSrlFile = 'server.srl'
const serverCertFile = 'server.crt'

const caSubject = '/C=US/ST=CA/L=Menlo Park/O=Sonar/CN=SonarCA'
const serverSubject = '/C=US/ST=CA/L=Menlo Park/O=Sonar/CN=localhost'
const deviceSubject = '/C=US/ST=CA/L=Menlo Park/O=Sonar/CN=sonarDevice'

export const generateCACert = async () => {
  ensureOpenSSLIsAvailable()

  const dir = await tmpDir({ unsafeCleanup: true })
  const caKeyPath = path.resolve(dir, caKeyFile)
  const caCertPath = path.resolve(dir, caCertFile)

  await openssl('genrsa', { out: caKeyPath, '2048': false })

  await openssl('req', {
    new: true,
    x509: true,
    subj: caSubject,
    key: caKeyPath,
    out: caCertPath
  })

  const caKey = await fs.readFile(caKeyPath, { encoding: 'utf8' })
  await fs.unlink(caKeyPath)
  const caCert = await fs.readFile(caCertPath, { encoding: 'utf8' })
  await fs.unlink(caCertPath)

  await fs.rmdir(dir)

  return { caKey, caCert }
}

export const generateServerCert = async (caKey, caCert) => {
  const dir = await tmpDir({ unsafeCleanup: true })
  const serverCertPath = path.resolve(dir, serverCertFile)
  const serverCsrPath = path.resolve(dir, serverCsrFile)
  const serverKeyPath = path.resolve(dir, serverKeyFile)
  const serverSrlPath = path.resolve(dir, serverSrlFile)

  const caCertPath = path.resolve(dir, caCertFile)
  await fs.writeFile(caCertPath, caCert, { encoding: 'utf8' })
  const caKeyPath = path.resolve(dir, caKeyFile)
  await fs.writeFile(caKeyPath, caKey, { encoding: 'utf8' })

  await openssl('genrsa', { out: serverKeyPath, '2048': false })
  await openssl('req', {
    new: true,
    key: serverKeyPath,
    out: serverCsrPath,
    subj: serverSubject
  })
  await openssl('x509', {
    req: true,
    in: serverCsrPath,
    CA: caCertPath,
    CAkey: caKeyPath,
    CAcreateserial: true,
    CAserial: serverSrlPath,
    out: serverCertPath
  })

  const serverSerial = await fs.readFile(serverSrlPath, { encoding: 'utf8' })
  await fs.unlink(serverSrlPath)
  const serverCert = await fs.readFile(serverCertPath, { encoding: 'utf8' })
  await fs.unlink(serverCertPath)
  const serverKey = await fs.readFile(serverKeyPath, { encoding: 'utf8' })
  await fs.unlink(serverKeyPath)
  await fs.unlink(serverCsrPath)
  await fs.unlink(caCertPath)
  await fs.unlink(caKeyPath)
  await fs.rmdir(dir)

  return { serverCert, serverKey, serverSerial }
}

export const generateClientCertificate = async (
  csr: string,
  caCert,
  caKey,
  serverSrl
) => {
  const dir = await tmpDir({ unsafeCleanup: true })
  const deviceCsrPath = path.resolve(dir, deviceCsrFile)
  const caCertPath = path.resolve(dir, caCertFile)
  const caKeyPath = path.resolve(dir, caKeyFile)
  const serverSrlPath = path.resolve(dir, serverSrlFile)

  await fs.writeFile(deviceCsrPath, csr)
  await fs.writeFile(caCertPath, caCert)
  await fs.writeFile(caKeyPath, caKey)
  await fs.writeFile(serverSrlPath, serverSrl)

  const deviceCert = await openssl('x509', {
    req: true,
    in: deviceCsrPath,
    CA: caCertPath,
    CAkey: caKeyPath,
    CAcreateserial: true,
    CAserial: serverSrlPath
  })

  serverSrl = await fs.readFile(serverSrlPath, { encoding: 'utf8' })
  await fs.unlink(serverSrlPath)
  await fs.unlink(caCertPath)
  await fs.unlink(caKeyPath)
  await fs.unlink(deviceCsrPath)
  await fs.rmdir(dir)

  return { deviceCert, serverSrl }
}

export const writeDeviceFiles = async (
  destination: string,
  deviceCert: string,
  caCert: string
) => {
  const deviceCertPath = path.resolve(destination, deviceCertFile)
  const caCertPath = path.resolve(destination, caCertFile)

  await fs.writeFile(deviceCertPath, deviceCert, { encoding: 'utf8' })
  await fs.writeFile(caCertPath, caCert, { encoding: 'utf8' })
}

//
// CLIENT ROUTINES
//

export const generateCsr = async () => {
  ensureOpenSSLIsAvailable()

  const dir = await tmpDir({ unsafeCleanup: true })
  const deviceKeyPath = path.resolve(dir, deviceKeyFile)
  const deviceCsrPath = path.resolve(dir, deviceCsrFile)

  await openssl('genrsa', { out: deviceKeyPath, '2048': false })
  await openssl('req', {
    new: true,
    key: deviceKeyPath,
    out: deviceCsrPath,
    subj: deviceSubject
  })

  const deviceKey = await fs.readFile(deviceKeyPath, { encoding: 'utf8' })
  await fs.unlink(deviceKeyPath)
  const deviceCsr = await fs.readFile(deviceCsrPath, { encoding: 'utf8' })
  await fs.unlink(deviceCsrPath)
  await fs.rmdir(dir)

  return { deviceKey, deviceCsr }
}

export const getDeviceSharedFolder = async () => {
  const dir = await tmpDir({ unsafeCleanup: true })
  return { destination: `${dir}/` }
}

export const getDeviceFiles = async (destination: string) => {
  const deviceCertPath = path.resolve(destination, deviceCertFile)
  const caCertPath = path.resolve(destination, caCertFile)
  const deviceCert = await fs.readFile(deviceCertPath, { encoding: 'utf8' })
  const caCert = await fs.readFile(caCertPath, { encoding: 'utf8' })
  return { deviceCert, caCert }
}

function ensureOpenSSLIsAvailable(): void {
  if (!opensslInstalled()) {
    const e = Error(
      "It looks like you don't have OpenSSL installed. Please install it to continue."
    )
    throw e
  }
}
