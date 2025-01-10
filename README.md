# Vite Plugin GLSL #

> Import, inline (and compress) GLSL shader files

![npm](https://img.shields.io/npm/dt/vite-plugin-lygia?style=flat-square)
![GitHub package.json version](https://img.shields.io/github/package-json/v/Nek/vite-plugin-lygia?color=brightgreen&style=flat-square)
![GitHub](https://img.shields.io/github/license/Nek/vite-plugin-lygia?color=brightgreen&style=flat-square)

## Installation ##

```sh
npm i vite-plugin-lygia --save-dev
# or
yarn add vite-plugin-lygia --dev
# or
pnpm add -D vite-plugin-lygia
# or
bun add vite-plugin-lygia --dev
```

## Usage ##

```js
// vite.config.js
import lygia from 'vite-plugin-lygia';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [lygia()]
});
```

### With TypeScript ###

Add extension declarations to your [`types`](https://www.typescriptlang.org/tsconfig#types) in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": [
      "vite-plugin-lygia/ext"
    ]
  }
}
```

or as a [package dependency directive](https://www.typescriptlang.org/docs/handbook/triple-slash-directives.html#-reference-types-) to your global types:

```ts
/// <reference types="vite-plugin-lygia/ext" />
```

## Default Options ##

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
