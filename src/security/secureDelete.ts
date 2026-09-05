/**
 * Nymir 安全删除模块
 *
 * 清理 localStorage 中的敏感数据
 */

/**
 * 清除 localStorage 中的敏感数据
 */
export function clearLocalStorage(prefix: string): void {
  const keys = Object.keys(localStorage).filter((k) => k.startsWith(prefix))
  for (const key of keys) {
    localStorage.removeItem(key)
  }
}
