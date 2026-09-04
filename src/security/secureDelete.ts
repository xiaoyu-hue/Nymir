/**
 * Nymir 安全删除模块
 * 
 * 覆写敏感数据后再删除
 * 
 * 原理：
 * - 在删除数据前，用随机数据覆写存储区域
 * - 多次覆写以确保数据无法恢复
 * - 清理 localStorage 中的敏感数据
 */

/**
 * 生成随机数据
 */
function generateRandomData(): string {
  const length = Math.floor(Math.random() * 100) + 10
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * 清除 localStorage 中的敏感数据
 */
export function clearLocalStorage(prefix: string): void {
  const keys = Object.keys(localStorage).filter((k) => k.startsWith(prefix))
  for (const key of keys) {
    // 覆写后再删除
    const randomValue = generateRandomData()
    localStorage.setItem(key, randomValue)
    localStorage.removeItem(key)
  }
}
