/**
 * Nymir 假名系统
 * 
 * 为每个用户生成随机匿名 ID
 * - 首次使用时生成
 * - 持久化存储在 localStorage
 * - 每个房间可以有不同假名
 * - 使用 crypto.getRandomValues 保证密码学安全随机
 */

import { secureRandomInt } from '../utils/random'

const STORAGE_KEY = 'nymir_anonymous_id'
const ROOM_NAMES_KEY = 'nymir_room_names'

// 扩展词库：40 形容词 × 40 名词 × 30 动物 × 10000 数字 = 4.8亿组合
const ADJECTIVES = [
  '安静的', '快乐的', '神秘的', '勇敢的', '聪明的',
  '温柔的', '活泼的', '优雅的', '善良的', '坚强的',
  '智慧的', '温柔的', '迅捷的', '深邃的', '闪耀的',
  '宁静的', '澎湃的', '无畏的', '灵动的', '温暖的',
  'calm', 'happy', 'brave', 'wise', 'gentle',
  'lively', 'elegant', 'kind', 'strong', 'clever',
  'swift', 'deep', 'bright', 'serene', 'bold',
  'warm', 'cool', 'wild', 'free', 'true',
]

const NOUNS = [
  '星星', '月亮', '太阳', '云朵', '风',
  '森林', '海洋', '山峰', '河流', '湖泊',
  '极光', '银河', '彗星', '流星', '彩虹',
  '潮汐', '冰川', '沙漠', '绿洲', '悬崖',
  'star', 'moon', 'sun', 'cloud', 'wind',
  'forest', 'ocean', 'mountain', 'river', 'lake',
  'aurora', 'galaxy', 'comet', 'meteor', 'rainbow',
  'tide', 'glacier', 'desert', 'oasis', 'cliff',
]

const ANIMALS = [
  '狐狸', '兔子', '鹿', '猫头鹰', '海豚',
  '蝴蝶', '蜜蜂', '松鼠', '海鸥', '天鹅',
  '狼', '鹰', '豹', '鲸鱼', '海龟',
  '熊猫', '雪豹', '信天翁', '火烈鸟', '水獭',
  'fox', 'rabbit', 'deer', 'owl', 'dolphin',
  'butterfly', 'bee', 'squirrel', 'seagull', 'swan',
]

/**
 * 生成随机假名
 */
function generateAnonymousName(): string {
  const adj = ADJECTIVES[secureRandomInt(ADJECTIVES.length)]
  const noun = NOUNS[secureRandomInt(NOUNS.length)]
  const animal = ANIMALS[secureRandomInt(ANIMALS.length)]
  const num = secureRandomInt(10000)

  // 格式：形容词 + 名词 + 动物 + 数字
  return `${adj}${noun}${animal}${num}`
}

/**
 * 获取或创建匿名 ID
 */
export function getAnonymousId(): string {
  let id = localStorage.getItem(STORAGE_KEY)
  if (!id) {
    id = generateAnonymousName()
    localStorage.setItem(STORAGE_KEY, id)
  }
  return id
}

/**
 * 获取房间内假名
 */
export function getRoomDisplayName(roomId: string, peerId: string, isSelf: boolean): string {
  if (isSelf) {
    return getAnonymousId()
  }

  // 从 localStorage 获取对端假名
  let roomNames: Record<string, string> = {}
  try {
    roomNames = JSON.parse(localStorage.getItem(ROOM_NAMES_KEY) || '{}')
  } catch {
    roomNames = {}
  }
  const key = `${roomId}:${peerId}`

  if (roomNames[key]) {
    return roomNames[key]
  }

  // 生成新假名并存储
  const name = generateAnonymousName()
  roomNames[key] = name
  localStorage.setItem(ROOM_NAMES_KEY, JSON.stringify(roomNames))

  return name
}

/**
 * 重置匿名 ID
 */
export function resetAnonymousId(): string {
  const newId = generateAnonymousName()
  localStorage.setItem(STORAGE_KEY, newId)
  return newId
}
