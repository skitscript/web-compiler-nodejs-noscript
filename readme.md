# Skitscript Web Compiler (no runtime Javascript, targeting NodeJS) [![Continuous Integration](https://github.com/skitscript/web-compiler-nodejs-noscript/workflows/Continuous%20Integration/badge.svg)](https://github.com/skitscript/web-compiler-nodejs-noscript/actions) [![License](https://img.shields.io/github/license/skitscript/web-compiler-nodejs-noscript.svg)](https://github.com/skitscript/web-compiler-nodejs-noscript/blob/master/license) [![Renovate enabled](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovatebot.com/) [![npm](https://img.shields.io/npm/v/skitscript/web-compiler-nodejs-noscript.svg)](https://www.npmjs.com/package/skitscript/web-compiler-nodejs-noscript) [![npm type definitions](https://img.shields.io/npm/types/skitscript/web-compiler-nodejs-noscript.svg)](https://www.npmjs.com/package/skitscript/web-compiler-nodejs-noscript)

A Skitscript document compiler targeting the web, built using NodeJS and
including no Javascript in its output.

## Installation

### Dependencies

This is a NPM package.  It targets NodeJS 16.11.1 or newer on the following
operating systems:

- Ubuntu 20.04
- Ubuntu 18.04
- macOS 11 (Big Sur)
- macOS 10.15 (Catalina)
- Windows Server 2022
- Windows Server 2019
- Windows Server 2016

It is likely also possible to use this package as part of a web browser
application through tools such as [webpack](https://webpack.js.org/).  This has
not been tested, however.

### Install as a runtime dependency

If your application uses this as a runtime dependency, install it like any other
NPM package:

```bash
npm install --save @skitscript/web-compiler-nodejs-noscript
```

Additionally install the types package:

```bash
npm install --save-dev @skitscript/types-nodejs
```

### Install `@skitscript/types-nodejs` as a peer dependency

If you are developing a package which includes types from
`@skitscript/types-nodejs` in its public API, additionally install it as a peer
dependency so that consumers of your package know to include it as well:

```bash
npm install --save-peer @skitscript/types-nodejs
```

### Install as a development dependency

If this is used when building your application and not at runtime, install it as
a development dependency:

```bash
npm install --save-dev @skitscript/web-compiler-nodejs-noscript @skitscript/types-nodejs
```

## Usage

TODO
