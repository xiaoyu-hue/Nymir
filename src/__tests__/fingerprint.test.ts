import { describe, it, expect } from 'vitest'
import {
  buildFingerprint,
  EMOJI_TABLE,
  type IdentityKeys,
} from '../security/fingerprint'

// 固定的伪公钥字符串（不是真密钥，只用于喂给纯函数做断言）
const ALICE: IdentityKeys = {
  encPub: 'alice-enc-public-key-base64-A',
  signPub: 'alice-sign-public-key-base64-S',
}
const BOB: IdentityKeys = {
  encPub: 'bob-enc-public-key-base64-A',
  signPub: 'bob-sign-public-key-base64-S',
}
const CAROL: IdentityKeys = {
  encPub: 'carol-enc-public-key-base64-X',
  signPub: 'carol-sign-public-key-base64-Y',
}
const DAVE: IdentityKeys = {
  encPub: 'dave-enc-public-key-base64-X',
  signPub: 'dave-sign-public-key-base64-Y',
}

describe('buildFingerprint', () => {
  it('多次调用结果确定（无随机）', async () => {
    const a = await buildFingerprint(ALICE, BOB)
    const b = await buildFingerprint(ALICE, BOB)
    expect(a).toEqual(b)
  })

  it('A 侧与 B 侧角色互换，指纹完全相同（排序无关）', async () => {
    const fromAlice = await buildFingerprint(ALICE, BOB)
    const fromBob = await buildFingerprint(BOB, ALICE)
    expect(fromAlice).toEqual(fromBob)
  })

  it('decimal 格式为 15 位数字、分 3 组×5', async () => {
    const { decimal } = await buildFingerprint(ALICE, BOB)
    expect(decimal).toMatch(/^\d{5} \d{5} \d{5}$/)
  })

  it('emojis 长度为 7，且全部来自固定表', async () => {
    const { emojis } = await buildFingerprint(ALICE, BOB)
    expect(emojis).toHaveLength(7)
    for (const e of emojis) {
      expect(EMOJI_TABLE).toContain(e)
    }
  })

  it('任一方加密公钥变化，decimal 必然变化', async () => {
    const base = await buildFingerprint(ALICE, BOB)
    const tampered = await buildFingerprint(
      { ...ALICE, encPub: ALICE.encPub + 'x' },
      BOB,
    )
    expect(tampered.decimal).not.toBe(base.decimal)
  })

  it('任一方签名公钥变化，decimal 必然变化', async () => {
    const base = await buildFingerprint(ALICE, BOB)
    const tampered = await buildFingerprint(
      { ...ALICE, signPub: ALICE.signPub + 'x' },
      BOB,
    )
    expect(tampered.decimal).not.toBe(base.decimal)
  })

  it('对方公钥变化，decimal 同样必然变化', async () => {
    const base = await buildFingerprint(ALICE, BOB)
    const tampered = await buildFingerprint(ALICE, {
      ...BOB,
      encPub: BOB.encPub + 'y',
    })
    expect(tampered.decimal).not.toBe(base.decimal)
  })

  it('公钥被篡改时，emojis 也必然变化', async () => {
    const base = await buildFingerprint(ALICE, BOB)
    const tampered = await buildFingerprint(
      { ...ALICE, encPub: ALICE.encPub + 'x' },
      BOB,
    )
    expect(tampered.emojis).not.toEqual(base.emojis)
  })

  it('两对完全不同的身份产生不同指纹（无明显碰撞）', async () => {
    const ab = await buildFingerprint(ALICE, BOB)
    const cd = await buildFingerprint(CAROL, DAVE)
    expect(ab.decimal).not.toBe(cd.decimal)
    expect(ab.emojis).not.toEqual(cd.emojis)
  })
})

describe('EMOJI_TABLE 静态约束', () => {
  it('恰好 64 个，且无重复', () => {
    expect(EMOJI_TABLE).toHaveLength(64)
    expect(new Set(EMOJI_TABLE).size).toBe(64)
  })
})
