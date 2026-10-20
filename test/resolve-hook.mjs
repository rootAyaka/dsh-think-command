/**
 * Test-only ESM resolve hook: the real Host resolves a profile plugin's
 * `@deepseek-ai/*` peer dependencies through dsh-app-boot's runtime
 * interception. This hook reproduces that behaviour for offline tests by
 * retrying failed `@deepseek-ai/*` resolutions from inside the dsh install.
 *
 * Override the anchor when dsh is installed somewhere else:
 *   DSH_ANCHOR=/path/to/dsh/lib/bin.js
 */
import { pathToFileURL } from 'node:url'

const ANCHOR = pathToFileURL(
  process.env.DSH_ANCHOR ?? '/usr/lib/node_modules/@deepseek-ai/dsh/lib/bin.js',
).href

export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context)
  } catch (error) {
    if (!specifier.startsWith('@deepseek-ai/')) throw error
    return next(specifier, { ...context, parentURL: ANCHOR })
  }
}
