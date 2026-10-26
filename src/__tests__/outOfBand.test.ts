// @vitest-environment jsdom
/**
 * 带外身份交换模块测试
 * 覆盖：身份序列化/解析往返、非法输入拒绝、指纹与在线核对一致性。
 */
import { describe, expect, it } from 'vitest'
import {
  serializeIdentity,
  parseIdentity,
  computeFingerprintOutOfBand,
  type IdentityKeys,
} from '../security/outOfBand'
import { buildFingerprint } from '../security/fingerprint'

const alice: IdentityKeys = {
  encPub: 'YWxpY2UtdGVzdC1lbmMta2V5LTAxMjM0NTY3ODk=',
  signPub: 'YWxpY2UtdGVzdC1zaWduLWtleS0wMTIzNDU2Nzg5',
}
const bob: IdentityKeys = {
  encPub: 'Ym9iLXRlc3QtZW5jLWtleS0wMTIzNDU2Nzg5',
  signPub: 'Ym9iLXRlc3Qtc2lnbi1rZXktMDEyMzQ1Njc4OQ==',
}

describe('outOfBand — 序列化/解析往返', () => {
  it('serialize → parse 得到原值', () => {
    const s = serializeIdentity(alice)
    expect(s.startsWith('nymir1:')).toBe(true)
    const parsed = parseIdentity(s)
    expect(parsed).toEqual(alice)
  })

  it('解析结果可用于计算指纹（与 buildFingerprint 一致）', async () => {
    const viaModule = await computeFingerprintOutOfBand(alice, bob)
    const direct = await buildFingerprint(alice, bob)
    expect(viaModule).toEqual(direct)
    // 双方角色互换仍得同一指纹（buildFingerprint 内部排序保证）
    const swapped = await computeFingerprintOutOfBand(bob, alice)
    expect(swapped.decimal).toBe(viaModule.decimal)
    expect(swapped.emojis).toEqual(viaModule.emojis)
  })
})

describe('outOfBand — 非法输入拒绝', () => {
  it('空 / 无前缀 / 坏 base64 返回 null', () => {
    expect(parseIdentity('')).toBeNull()
    expect(parseIdentity('hello world')).toBeNull()
    expect(parseIdentity('nymir1:!!!!notbase64')).toBeNull()
    expect(parseIdentity('nymir2:eyJlIjoiYWJjIn0=')).toBeNull()
  })

  it('缺少字段的 JSON 返回 null', () => {
    // 构造一个前缀正确但 payload 缺 s 字段的串
    const bad = 'nymir1:' + btoa(JSON.stringify({ e: alice.encPub }))
    // 标准 base64 含 = 填充，parse 会失败于 isBase64Like 校验或字段缺失
    expect(parseIdentity(bad)).toBeNull()
  })

  it('前后多余空白被 trim 后正常解析', () => {
    const s = '  ' + serializeIdentity(bob) + '  \n'
    expect(parseIdentity(s)).toEqual(bob)
  })
})
