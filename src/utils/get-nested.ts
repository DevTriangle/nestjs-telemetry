export const getNested = (obj: any, keys: string[]) => keys.reduce((xs, x) => xs?.[x] ?? null, obj)
