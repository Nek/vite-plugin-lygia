import type { Plugin } from 'vite';

/**
 * @function
 * @name glsl
 * @description Plugin entry point to import,
 * inline, (and compress) GLSL shader files
 * 
 * @see {@link https://vitejs.dev/guide/api-plugin.html}
 * @link https://github.com/UstymUkhman/vite-plugin-glsl
 * 
 * @param {{enableHmr: boolean}} options Plugin config object
 * 
 * @returns {Plugin} Vite plugin that converts shader code
 */
export default function ({enableHmr}: {enableHmr: boolean}): Plugin;
