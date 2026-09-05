/**
 * 加密安全随机工具
 */

/**
 * 加密安全随机整数 [0, max)
 */
export function secureRandomInt(max: number): number {
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  return array[0] % max
}
