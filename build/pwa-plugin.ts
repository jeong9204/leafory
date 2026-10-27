import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { resolve, relative } from 'node:path'
import type { Plugin } from 'vite'
import { serviceWorkerSource } from '../src/pwa/service-worker-source.ts'

export function leaforyPwa(): Plugin {
  let publicDir = ''
  return {
    name: 'leafory-pwa-shell',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      publicDir = config.publicDir
    },
    generateBundle: {
      order: 'post',
      async handler(_, bundle) {
        const hash = createHash('sha256')
        const urls: string[] = []
        for (const name of Object.keys(bundle).sort()) {
          const file = bundle[name]
          if (name.endsWith('.map')) continue
          urls.push(`/${name}`)
          hash
            .update(name)
            .update(file.type === 'chunk' ? file.code : file.source)
        }
        const files = await readdir(publicDir, {
          recursive: true,
          withFileTypes: true,
        })
        for (const entry of files
          .filter((file) => file.isFile())
          .sort((a, b) => a.name.localeCompare(b.name))) {
          if (entry.name.startsWith('.')) continue
          const path = resolve(entry.parentPath, entry.name)
          const name = relative(publicDir, path).replaceAll('\\', '/')
          urls.push(`/${name}`)
          hash.update(name).update(await readFile(path))
        }
        // Include the worker implementation in the version: policy-only edits must update too.
        hash.update(serviceWorkerSource('', []))
        this.emitFile({
          type: 'asset',
          fileName: 'sw.js',
          source: serviceWorkerSource(
            hash.digest('hex').slice(0, 16),
            urls.sort(),
          ),
        })
      },
    },
  }
}
