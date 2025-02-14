/**
 * Get a key from an object with a dotted syntax.
 *
 * @example get({ foot: { bar: 'baz' } }, 'foo.bar') // 'baz'
 */
export const get = (obj: any, path: string | string[], defValue = undefined) => {
  if (!path) { return undefined }

  const pathArray = Array.isArray(path) ? path : path.match(/([^[.\]])+/g)

  const result = (pathArray || []).reduce(
    (prevObj, key) => prevObj && prevObj[key],
    obj,
  )

  return result === undefined ? defValue : result
}
