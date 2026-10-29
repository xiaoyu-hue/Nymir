/**
 * 第三方开源组件清单（运行时依赖）。
 *
 * 用途：设置 → 关于 抽屉内的「开源致谢」区块从此处读取并渲染，
 * 与 README「致谢与依赖」保持单一事实来源，后续维护只改这一个文件。
 *
 * 范围：仅列用户实际运行会用到的运行时依赖（不含构建/测试工具链）。
 * 许可证信息以各包发布版本为准，如有偏差请以官方声明为优先。
 */

export interface ThirdPartyDep {
  /** 组件名称（展示用） */
  name: string
  /** 开源许可证标识（如 MIT / ISC / Apache-2.0） */
  license: string
  /** 官方主页或仓库地址 */
  url: string
}

export const runtimeDependencies: ThirdPartyDep[] = [
  { name: 'React', license: 'MIT', url: 'https://react.dev' },
  { name: 'React DOM', license: 'MIT', url: 'https://react.dev' },
  { name: 'lucide-react', license: 'ISC', url: 'https://lucide.dev' },
  {
    name: '@trystero-p2p/mqtt',
    license: 'MIT',
    url: 'https://www.npmjs.com/package/@trystero-p2p/mqtt',
  },
  {
    name: '@trystero-p2p/torrent',
    license: 'MIT',
    url: 'https://www.npmjs.com/package/@trystero-p2p/torrent',
  },
  {
    name: '@trystero-p2p/nostr',
    license: 'MIT',
    url: 'https://www.npmjs.com/package/@trystero-p2p/nostr',
  },
  { name: 'idb', license: 'ISC', url: 'https://github.com/jakearchibald/idb' },
  { name: 'qrcode', license: 'MIT', url: 'https://www.npmjs.com/package/qrcode' },
  { name: 'jsQR', license: 'Apache-2.0', url: 'https://github.com/cozmo/jsQR' },
]
