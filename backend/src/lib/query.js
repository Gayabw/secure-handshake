export function parsePositiveInt(value, name) {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    const err = new Error(`${name} must be a positive integer`);
    err.statusCode = 400;
    throw err;
  }
  return n;
}

export function parseLimit(value, defaultLimit = 50, maxLimit = 200) {
  if (value === undefined || value === null || value === "") return defaultLimit;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0 || n > maxLimit) {
    const err = new Error(`limit must be an integer between 1 and ${maxLimit}`);
    err.statusCode = 400;
    throw err;
  }
  return n;
}
