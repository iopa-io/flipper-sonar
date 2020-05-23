# Flipper SONAR SDK -- for Node, Electron and Browser

This is the mono repository containing Custom [Flipper](https://fbflipper.com) Client for Node, Electron and Browser based applications.

These clients use the exact same rsocket protocol with private certificate exchange as the Flipper iOS, Android and React-Native SDKs, and so you do not need a custom Flipper Desktop application to use this -- the direct download from fbflipper.com will work.

See [flipper-node](./packages/flipper-node/README.md) in this repository for more details.

## Directory structure

The core custom client SDKs are in `packages`

Standard Flipper plugins are in `plugins` and in each folder are the `desktop` and a `device` halves of each plugin.  The `desktop` is a standard Flipper desktop plugin, whereas `device` are platform-specific and targeted to run on Node, Electron and Browser only.   

We like this organization as it encapsulates all the logic assocated with a plugin in one place.

An sample app and a sample custom plugin are in each of these respective folders too.

## License

MIT


## Naming

Flipper was called Sonar before it was open sourced by Facebook.   We always liked the Sonar name better, and call these enhancements Flipper Sonar as we also use them in our own app Sync Sonar.   But we've open sourced everything needed to instrument your own desktop apps.