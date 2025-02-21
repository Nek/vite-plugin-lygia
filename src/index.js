/**
 * @module vite-plugin-lygia
 * @author Nikita Dudnik <nikdudnik@gmail.com>
 * @description Import GLSL from lygia.xyz
 * @version 1.0.0
 * @license MIT
 */

import { transformWithEsbuild } from 'vite';
import path from 'path';
import fetch from 'node-fetch';
import * as fs from 'fs/promises';

const CACHE_DIR = path.join(process.cwd(), '.lygia');

async function ensureLygiaCacheDir(lygiaShaderInclude) {
  try {
    const shaderFileDir = path.dirname(path.join(CACHE_DIR, lygiaShaderInclude.substring(5)));
    await fs.mkdir(shaderFileDir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

async function getCachedLygiaFile(lygiaShaderInclude) {
  const lygiaShaderPathname = lygiaShaderInclude.substring(5);
  const lygiaShaderFile = path.join(CACHE_DIR, lygiaShaderPathname);
  try {
    const source = await fs.readFile(lygiaShaderFile, 'utf8');
    return resolveShader(source, lygiaShaderFile);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    const lygiaShaderUrl = 'https://lygia.xyz' + lygiaShaderPathname;
    const response = await fetch(lygiaShaderUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${lygiaShaderUrl}: ${response.statusText}`);
    }
    const content = await response.text();
    await fs.writeFile(lygiaShaderFile, content);
    return content;
  }
}

async function getLocalFile(filepath) {
  try {
    const source = await fs.readFile(filepath, 'utf8');
    return resolveShader(source, filepath);
  } catch (err) {
    throw new Error(`Failed to read local file ${filepath}: ${err.message}`);
  }
}

async function resolveShader(source, resourcePath) {
  
  const lines = source.split(/\r?\n/);
  const resolvedLines = await Promise.all(
    lines.map(async (line) => {
      const line_trim = line.trim();
      if (line_trim.startsWith('#include "')) {
        const includePath = line_trim.substring(9).replace(/\"|\;|\s/g, '');
        
        if (includePath.startsWith('lygia')) {
          await ensureLygiaCacheDir(includePath);
          return await getCachedLygiaFile(includePath);
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
const DEFAULT_SHADERS = /(glsl|wgsl|vert|frag|vs|fs)$/;

function isShader(shader) {
  return DEFAULT_SHADERS.test(shader);
}

/**
 * @function
 * @name glsl
 * @description Plugin entry point to import,
 * inline, (and compress) GLSL shader files
 * 
 * @see {@link https://vitejs.dev/guide/api-plugin.html}
 * @link https://github.com/Nek/vite-plugin-lygia
 * 
 * @param {import('./types').PluginOptions} options Plugin config object
 * 
 * @returns {import('vite').Plugin} Vite plugin that converts shader code
 */
export default function () {
  let sourcemap = false;
  const prod = process.env.NODE_ENV === 'production';

  return {
    enforce: 'pre',
    name: 'vite-plugin-lygia',

    configResolved (resolvedConfig) {
      sourcemap = resolvedConfig.build.sourcemap;
    },

    async transform (source, shader) {
      if (!isShader(shader)) return;

      let outputShader = await resolveShader(source, shader);
      
      return await transformWithEsbuild(outputShader, shader, {
        sourcemap: sourcemap && 'external',
        loader: 'text', format: 'esm',
        minifyWhitespace: prod
      });
    },

    handleHotUpdate({ file, server }) {
      if (!isShader(file)) return;
      server.ws.send({ type: 'full-reload' })
      return []
    }
  }
}
