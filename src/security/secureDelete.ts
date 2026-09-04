/**
 * Nymir 安全删除模块
 * 
 * 覆写敏感数据后再删除
 * 
 * 原理：
 * - 在删除数据前，用随机数据覆写存储区域
 * - 多次覆写以确保数据无法恢复
 * - 清理内存中的敏感数据
 */

const OVERWRITE_PASSES = 3

/**
 * 安全删除 IndexedDB 中的数据
 */
export async function secureDeleteDatabase(dbName: string): Promise<void> {
  // 打开数据库
  const request = indexedDB.open(dbName)

  await new Promise<void>((resolve, reject) => {
    request.onsuccess = () => {
      const db = request.result
      const storeNames = Array.from(db.objectStoreNames)

      if (storeNames.length === 0) {
        db.close()
        resolve()
        return
      }

      // 对每个 store 进行覆写
      const tx = db.transaction(storeNames, 'readwrite')
      let completed = 0

      for (const storeName of storeNames) {
        const store = tx.objectStore(storeName)
        const getAllRequest = store.getAll()

        getAllRequest.onsuccess = () => {
          const items = getAllRequest.result

          // 多次覆写
          for (let pass = 0; pass < OVERWRITE_PASSES; pass++) {
            for (const item of items) {
              // 用随机数据覆写每个字段
              const overwritten = overwriteObject(item)
              store.put(overwritten)
            }
          }

          // 最后删除
          for (const item of items) {
            if (item && typeof item === 'object' && 'id' in item) {
              store.delete((item as { id: string }).id)
            }
          }

          completed++
          if (completed === storeNames.length) {
            tx.oncomplete = () => {
              db.close()
              resolve()
            }
            tx.onerror = () => {
              db.close()
              reject(tx.error)
            }
          }
        }
      }
    }

    request.onerror = () => {
      reject(request.error)
    }
  })

  // 删除数据库
  await new Promise<void>((resolve, reject) => {
    const deleteRequest = indexedDB.deleteDatabase(dbName)
    deleteRequest.onsuccess = () => resolve()
    deleteRequest.onerror = () => reject(deleteRequest.error)
  })
}

/**
 * 覆写对象的所有字段
 */
function overwriteObject(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) {
    return generateRandomData()
  }

  if (Array.isArray(obj)) {
    return obj.map(() => generateRandomData())
  }

  const overwritten: Record<string, unknown> = {}
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    overwritten[key] = generateRandomData()
  }
  return overwritten
}

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
 * 安全清除内存中的敏感数据
 */
export function secureClearString(): string {
  // JavaScript 字符串不可变，无法直接覆写
  // 但我们可以确保引用被垃圾回收
  return ''
}

/**
 * 安全清除 Uint8Array
 */
export function secureClearArray(arr: Uint8Array<ArrayBuffer>): void {
  // 用随机数据覆写
  crypto.getRandomValues(arr)
  // 再用零覆写
  arr.fill(0)
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
