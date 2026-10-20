/**
 * Stable plugin entry: re-import the implementation under a unique URL on every
 * activation so an edited `/think` implementation takes effect on the next
 * plugin (re)activation without restarting the Host process.
 *
 * The Host's ESM module cache keeps a fixed entry file forever; the query-string
 * module generation is the supported way to hot-reload it from the Loader.
 */
export const name = 'command-think'
export const inject = ['commands', 'llm']

export async function apply(ctx, config) {
  const generation = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  const specifier = new URL(`./impl.js?gen=${generation}`, import.meta.url).href
  const implementation = await import(specifier)
  return implementation.apply(ctx, config)
}
