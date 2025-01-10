/**
 * @module vite-plugin-glsl
 * @author Ustym Ukhman <ustym.ukhman@gmail.com>
 * @description Import, inline (and compress) GLSL shader files
 * @version 1.3.1
 * @license MIT
 */

import { createFilter } from '@rollup/pluginutils';
import { transformWithEsbuild } from 'vite';
import path from 'path';
import fetch from 'node-fetch';
import * as fs from 'fs/promises';

const CACHE_DIR = path.join(process.cwd(), '.lygia-cache');

async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

async function getCachedFile(url) {
  const filename = path.join(CACHE_DIR, Buffer.from(url).toString('base64'));
  try {
    return await fs.readFile(filename, 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    const content = await response.text();
    await fs.writeFile(filename, content);
    return content;
  }
}

async function getLocalFile(filepath) {
  try {
    return await fs.readFile(filepath, 'utf8');
  } catch (err) {
    throw new Error(`Failed to read local file ${filepath}: ${err.message}`);
  }
}

async function resolveShader(source, resourcePath) {
  await ensureCacheDir();
  
  const lines = source.split(/\r?\n/);
  const resolvedLines = await Promise.all(
    lines.map(async (line) => {
      const line_trim = line.trim();
      if (line_trim.startsWith('#include "')) {
        const includePath = line_trim.substring(9).replace(/\"|\;|\s/g, '');
        
        if (includePath.startsWith('lygia')) {
          const include_url = 'https://lygia.xyz' + 
            includePath.substring(5);
          return await getCachedFile(include_url);
        } else {
          // Resolve local path relative to the current shader file
          const localPath = path.resolve(path.dirname(resourcePath), includePath);
          return await getLocalFile(localPath);
        }
      }
      return line;
    })
  );

  return resolvedLines.join('\n');
}

/**
 * @const
 * @default
 * @readonly
 * @type {readonly RegExp[]}
 */
const DEFAULT_SHADERS = Object.freeze([
  '**/*.glsl', '**/*.wgsl',
  '**/*.vert', '**/*.frag',
  '**/*.vs', '**/*.fs'
]);

/**
 * @function
 * @name glsl
 * @description Plugin entry point to import,
 * inline, (and compress) GLSL shader files
 * 
 * @see {@link https://vitejs.dev/guide/api-plugin.html}
 * @link https://github.com/UstymUkhman/vite-plugin-glsl
 * 
 * @param {import('./types').PluginOptions} options Plugin config object
 * 
 * @returns {import('vite').Plugin} Vite plugin that converts shader code
 */
export default function ({
    include = DEFAULT_SHADERS,
    exclude = undefined,
  } = {}
) {
  let sourcemap = false;
  const filter = createFilter(include, exclude);
  const prod = process.env.NODE_ENV === 'production';

  return {
    enforce: 'pre',
    name: 'vite-plugin-glsl',

    configResolved (resolvedConfig) {
      sourcemap = resolvedConfig.build.sourcemap;
    },

    async transform (source, shader) {
      if (!filter(shader)) return;

      let outputShader = await resolveShader(source, shader);
      
      return await transformWithEsbuild(outputShader, shader, {
        sourcemap: sourcemap && 'external',
        loader: 'text', format: 'esm',
        minifyWhitespace: prod
      });
    }
  };
}
