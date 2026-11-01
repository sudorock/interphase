function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (Object.prototype.toString.call(value) !== '[object Object]') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
}

export function hashKey(value: unknown): string {
  return JSON.stringify(value, (_, val) =>
    isPlainObject(val)
      ? Object.keys(val).sort().reduce((result, key) => {
          result[key] = val[key];
          return result;
        }, {} as Record<string, unknown>)
      : val
  );
}
