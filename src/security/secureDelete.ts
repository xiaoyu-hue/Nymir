/**
 * Nymir 安全删除模块
 *
 * 清理 localStorage 中的敏感数据
 */

/**
 * 清除 localStorage 中的敏感数据
 *
 * 能力边界（勿高估）：仅调用 removeItem 移除键值，无覆写。
 * 浏览器不保证物理擦除，磁盘取证仍可能恢复旧值。
 * 详见 README「安全注意事项 / 已知局限」。
 */
export function clearLocalStorage(prefix: string): void {
  const keys = Object.keys(localStorage).filter((k) => k.startsWith(prefix))
  for (const key of keys) {
    localStorage.removeItem(key)
  }
}
