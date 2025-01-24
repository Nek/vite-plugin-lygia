# Vite Plugin Lygia

Import GLSL/WGSL shaders from Lygia - a granular and modular shader library.

Key benefits:
- Automatic resolution of Lygia's module paths directly in shaders at build time
- Supports both GLSL and WGSL shader languages
- Works with local files and Lygia's CDN-hosted modules
- Enables modular shader composition with `#include` directives
- Built-in caching for improved development performance

![npm](https://img.shields.io/npm/dt/vite-plugin-lygia?style=flat-square)
![GitHub package.json version](https://img.shields.io/github/package-json/v/Nek/vite-plugin-lygia?color=brightgreen&style=flat-square)
![GitHub](https://img.shields.io/github/license/Nek/vite-plugin-lygia?color=brightgreen&style=flat-square)

## Installation

```sh
npm i vite-plugin-lygia-resolver --save-dev
# or
yarn add vite-plugin-lygia-resolver --dev
# or
pnpm add -D vite-plugin-lygia-resolver
# or
bun add vite-plugin-lygia-resolver --dev
```

## Usage

```js
// vite.config.js
import lygia from 'vite-plugin-lygia-resolver';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [lygia()]
});
```

### With TypeScript

Add extension declarations to your [`types`](https://www.typescriptlang.org/tsconfig#types) in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": [
      "vite-plugin-lygia-resolver/ext"
    ]
  }
}
```

or as a [package dependency directive](https://www.typescriptlang.org/docs/handbook/triple-slash-directives.html#-reference-types-) to your global types:

```ts
/// <reference types="vite-plugin-lygia-resolver/ext" />
```

## Default Options

```js
glsl({
  include: [                   // Glob pattern, or array of glob patterns to import
    '**/*.glsl', '**/*.wgsl',
    '**/*.vert', '**/*.frag',
    '**/*.vs', '**/*.fs'
  ],
  exclude: undefined,          // Glob pattern, or array of glob patterns to ignore
})
```
