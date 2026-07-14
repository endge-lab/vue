/**
 * Temporary compatibility stub for legacy JSX components.
 * It intentionally supports only direct reads from component data and never executes code.
 */
export function resolveLegacyValue(
  expression: string,
  data: Record<string, unknown>,
): unknown {
  const key = String(expression ?? '').trim()
  if (!key) return undefined
  return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : undefined
}
