/* eslint-disable  */
const path = require('path')

process.platform = process.platform || "electron"
process.type = 'main'
process.versions = {}

// Polyfill for atob and btoa
// Copyright (c) 2011..2012 David Chambers <dc@hashify.me>
!(function() {
  function t(t) {
    this.message = t
  }
  const r = typeof exports !== 'undefined' ? exports : this
  const e = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
  ;(t.prototype = new Error()),
    (t.prototype.name = 'InvalidCharacterError'),
    r.btoa ||
      (r.btoa = function(r) {
        for (
          var o, n, a = String(r), i = 0, c = e, d = '';
          a.charAt(0 | i) || ((c = '='), i % 1);
          d += c.charAt(63 & (o >> (8 - (i % 1) * 8)))
        ) {
          if (((n = a.charCodeAt((i += 0.75))), n > 255)) {
            throw new t(
              "'btoa' failed: The string to be encoded contains characters outside of the Latin1 range."
            )
          }
          o = (o << 8) | n
        }
        return d
      }),
    r.atob ||
      (r.atob = function(r) {
        const o = String(r).replace(/=+$/, '')
        if (o.length % 4 == 1) {
          throw new t(
            "'atob' failed: The string to be decoded is not correctly encoded."
          )
        }
        for (
          var n, a, i = 0, c = 0, d = '';
          (a = o.charAt(c++));
          ~a && ((n = i % 4 ? 64 * n + a : a), i++ % 4)
            ? (d += String.fromCharCode(255 & (n >> ((-2 * i) & 6))))
            : 0
        ) {
          a = e.indexOf(a)
        }
        return d
      })
})()

require('sucrase/register/ts-legacy-module-interop')
require('sucrase/dist/register').addHook('.tsx', {
  transforms: ['imports', 'typescript', 'jsx'],
  enableLegacyTypeScriptModuleInterop: true,
  jsxPragma: 'ReactiveCards.h'
})

const Module = require('module')

const originalRequire = Module.prototype.require

const proxyCache = {}

Module.prototype.require = function(name) {
  if (name === 'native_module') {
    return {
      ln: () => {
        /** noop */
      },
      loadFromSource: (id, src) => {
        if (id === 'syncware') {
          const mw = class Syncware {
            constructor(app) {
              // eslint-disable-next-line no-undef
              ai.karla.syncware(app)
            }

            invoke(context, next) {
              return next()
            }
          }
          return { default: mw }
        }
        console.log('LOAD FROM SOURCE NOT SUPPORTED ON WEB', id, src)
        return null
      }
    }
  }

  if (name in proxyCache) {
    return originalRequire.apply(this, [proxyCache[name]])
  }

  // TEST IF FIRST PATH INTO NODE_MODULE
  if (/(^[^.\/]*$)|(^@[^.\/]*\/[^.\/]*$)/.test(name)) {
    let packagefile
    try {
      packagefile = require.resolve(`${name}/package.json`)
    } catch (ex) {
      // noop: base node module
    }

    if (packagefile && !packagefile.includes('/node_modules/')) {
      const packagejson = originalRequire.apply(this, [packagefile])
      const main = packagejson['ts:main'] || packagejson.main || 'index.js'
      const abspath = path.join(path.dirname(packagefile), main)
      proxyCache[name] = abspath
      return originalRequire.apply(this, [abspath])
    }
  }

  return originalRequire.apply(this, arguments)
}
