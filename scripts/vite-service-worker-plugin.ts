import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import type { Plugin } from 'vite';

const TEMPLATE_PATH = fileURLToPath(new URL('../pwa/sw.js', import.meta.url));

/**
 * Emits `sw.js` at build time with a cache version derived from the emitted file names and a
 * precache list containing only the entry chunk(s), entry CSS and the HTML shell. Lazily loaded
 * feature chunks (map, charts, ...) are cached on first use instead, so installing the app never
 * downloads features the user has not opened.
 */
export function serviceWorkerPlugin(): Plugin {
  return {
    name: 'together-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const entryFiles = new Set<string>();
      for (const output of Object.values(bundle)) {
        if (output.type === 'chunk' && output.isEntry) {
          entryFiles.add(output.fileName);
          for (const css of output.viteMetadata?.importedCss ?? []) entryFiles.add(css);
        }
      }
      const allFileNames = Object.keys(bundle).sort();
      const buildId = createHash('sha256')
        .update(allFileNames.join('\n'))
        .digest('hex')
        .slice(0, 12);
      const precache = ['/', ...[...entryFiles].sort().map((file) => `/${file}`)];
      const source = readFileSync(TEMPLATE_PATH, 'utf8')
        .replace('__BUILD_ID__', buildId)
        .replace("'__PRECACHE_URLS__'", JSON.stringify(JSON.stringify(precache)));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}
