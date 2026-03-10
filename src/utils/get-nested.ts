export function getNested(obj: any, keys: string[]) {
  return keys.reduce((xs, x) => xs?.[x] ?? null, obj)
}
