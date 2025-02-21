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
const SHADER_EXTENSIONS = /(glsl|wgsl|vert|frag|vs|fs)$/;
const CODE_EXTENSIONS = /(js|ts|jsx|tsx)$/;

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
export default function vitePluginLygiaResolver({ enableHmr } = { enableHmr: false}) {
  const shaderParents = new Map();

  const prod = process.env.NODE_ENV === 'production';

  return {
    enforce: 'pre',
    name: 'vite-plugin-lygia-resolver',

    async transform(code, id) {
      if (!SHADER_EXTENSIONS.test(id)) return;

      try {
        const resolvedSource = await resolveShader(id, code);

        return {
          code: `export default ${JSON.stringify(resolvedSource)};`,
          map: { mappings: "" },
        };
      } catch (error) {
        console.error(`[vite-plugin-lygia] Shader resolution failed: ${error.message}`);
      }
    },

    async hotUpdate({ file, server, timestamp }) {
      if (!SHADER_EXTENSIONS.test(file)) return;

      if (!enableHmr) {
        server.ws.send({
          type: "full-reload",
          path: "*",
        });
        return [];
      };

      const topLevelGLSLFiles = new Set();
      function findTopLevelGLSLFiles(file) {
        const parentShaders = shaderParents.get(file);
        if (!parentShaders) {
          topLevelGLSLFiles.add(file);
        } else {
          parentShaders.forEach((parent) => {
            findTopLevelGLSLFiles(parent);
          });
        }
      }

      findTopLevelGLSLFiles(file);
      const modulesToReload = new Set();
      topLevelGLSLFiles.forEach((glslFile) => {
        const mod = server.moduleGraph.getModuleById(glslFile);
        if (mod) {
          mod.importers.forEach((importer) => {
            if (importer.id && CODE_EXTENSIONS.test(importer.id)) {
              modulesToReload.add(importer.id);
            }
          });
        }
      });

      if (modulesToReload.size > 0) {
        console.info(`[vite-plugin-lygia-shader] GLSL changed: ${file}, reloading dependent modules: ${Array.from(modulesToReload).join(', ')}.`);

        // Invalidate all dependent modules
        modulesToReload.forEach((modulePath) => {
          const mod = server.moduleGraph.getModuleById(modulePath);
          if (mod) {
            server.moduleGraph.invalidateModule(mod);
          }
        });

        // Trigger HMR update
        server.ws.send({
          type: "custom",
          event: "shader-update",
          data: { file, timestamp },
        });
      }
    }
  }

  async function ensureLygiaCacheDir(lygiaShaderPathname) {
    try {
      const shaderFileDir = path.dirname(path.join(CACHE_DIR, lygiaShaderPathname));
      await fs.mkdir(shaderFileDir, { recursive: true });
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }
  }

  async function resolveShader(shaderFilepath, shaderSource) {
    const dependencies = new Set(); // Stores GLSL dependencies

    // Add the shader file itself to the dependencies
    // dependencies.add(shaderFilepath);

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
              const resolvedShader = await resolveShader(lygiaShaderFilepath, source);
              dependencies.add(lygiaShaderFilepath);
              return resolvedShader;
            } catch (err) {
              if (err.code !== 'ENOENT') throw err;
              const lygiaShaderUrl = 'https://lygia.xyz' + lygiaShaderPathname;
              const response = await fetch(lygiaShaderUrl);
              if (!response.ok) {
                throw new Error(`Failed to fetch ${lygiaShaderUrl}: ${response.statusText}`);
              }
              const source = await response.text();
              await fs.writeFile(lygiaShaderFilepath, content);
              dependencies.add(lygiaShaderFilepath);
              return source;
            }
          } else {
            // Resolve local path relative to the current shader file
            const localShaderFilepath = path.resolve(path.dirname(shaderFilepath), includePath);
            try {
              const source = await fs.readFile(localShaderFilepath, 'utf8');
              const resolvedShader = await resolveShader(localShaderFilepath, source);
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
    dependencies.forEach((dep) => {
      if (!shaderParents.has(dep)) {
        shaderParents.set(dep, new Set());
      }
      shaderParents.get(dep).add(shaderFilepath);
    });

    return resolvedLines.join('\n');
  }
}
