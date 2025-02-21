/**
 * @module vite-plugin-lygia-resolver
 * @author Nikita Dudnik <nikdudnik@gmail.com>
 * @description Import GLSL from lygia.xyz
 * @version 1.3.0
 * @license MIT
 */

import { transformWithEsbuild } from 'vite';
import path from 'path';
import fetch from 'node-fetch';
import * as fs from 'fs/promises';

const CACHE_DIR = path.join(process.cwd(), '.lygia');

async function ensureLygiaCacheDir(lygiaShaderPathname) {
  try {
    const shaderFileDir = path.dirname(path.join(CACHE_DIR, lygiaShaderPathname));
    await fs.mkdir(shaderFileDir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

async function resolveShader(shaderSource, shaderFilepath, shaderDependencies) {
  const dependencies = new Set(); // Stores GLSL dependencies

  // Add the shader file itself to the dependencies
  dependencies.add(shaderFilepath);

  const lines = shaderSource.split(/\r?\n/);
  const resolvedLines = await Promise.all(
    lines.map(async (line) => {
      const line_trim = line.trim();
      if (line_trim.startsWith('#include "')) {
        const includePath = line_trim.substring(9).replace(/\"|\;|\s/g, '');

        if (includePath.startsWith('lygia')) {
          const lygiaShaderPathname = includePath.substring(5);

          await ensureLygiaCacheDir(lygiaShaderPathname);

          const lygiaShaderFilepath = path.join(CACHE_DIR, lygiaShaderPathname);
          try {
            const source = await fs.readFile(lygiaShaderFilepath, 'utf8');
            const resolvedShader = await resolveShader(source, lygiaShaderFilepath, shaderDependencies);
            dependencies.add(lygiaShaderFilepath);
            return resolvedShader;
          } catch (err) {
            if (err.code !== 'ENOENT') throw err;
            const lygiaShaderUrl = 'https://lygia.xyz' + lygiaShaderPathname;
            const response = await fetch(lygiaShaderUrl);
            if (!response.ok) {
              throw new Error(`Failed to fetch ${lygiaShaderUrl}: ${response.statusText}`);
            }
            const content = await response.text();
            await fs.writeFile(lygiaShaderFilepath, content);
            dependencies.add(lygiaShaderFilepath);
            return content;
          }
        } else {
          // Resolve local path relative to the current shader file
          const localShaderFilepath = path.resolve(path.dirname(shaderFilepath), includePath);
          try {
            const source = await fs.readFile(localShaderFilepath, 'utf8');
            const resolvedShader = await resolveShader(source, localShaderFilepath, shaderDependencies);
            dependencies.add(localShaderFilepath);
            return resolvedShader;
          } catch (err) {
            throw new Error(`Failed to read local file ${localShaderFilepath}: ${err.message}`);
          }
        }
      }
      return line;
    })
  );

  // Store the dependencies for the shader file
  shaderDependencies.set(shaderFilepath, dependencies);
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
export default function vitePluginLygiaResolver() {
  const shaderDependencies = new Map(); // Store GLSL dependencies

  let sourcemap = false;
  const prod = process.env.NODE_ENV === 'production';

  return {
    enforce: 'pre',
    name: 'vite-plugin-lygia',

    configResolved(resolvedConfig) {
      sourcemap = resolvedConfig.build.sourcemap;
    },

    async transform(shaderSource, shaderFilepath) {
      if (!isShader(shaderFilepath)) return;

      let outputShader = await resolveShader(shaderSource, shaderFilepath, shaderDependencies);

      return await transformWithEsbuild(outputShader, shaderFilepath, {
        sourcemap: sourcemap && 'external',
        loader: 'text', format: 'esm',
        minifyWhitespace: prod
      });
    },

    handleHotUpdate({ file, server }) {
      if (!isShader(file)) return;
      const modulesToReload = new Set();

      for (const [glslFile, deps] of shaderDependencies.entries()) {
        if (deps.has(file)) {
          modulesToReload.add(glslFile);
        }
      }
      if (modulesToReload.size > 0) {
        console.log(`[vite-plugin-lygia-shader] GLSL changed: ${file}, reloading dependent shaders...`);

        // Invalidate all dependent modules
        modulesToReload.forEach((glslFile) => {
          const module = server.moduleGraph.getModuleById(glslFile);
          if (module) {
            server.moduleGraph.invalidateModule(module);
          }
        });

        // Trigger HMR update
        server.ws.send({
          type: "full-reload",
          path: "*",
        });

        return [];
      }
    }
  }
}
