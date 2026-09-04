const zh = {
  app: {
    subtitle: '匿名树洞 · 阅读即焚 · 数据主权归你',
  },
  room: {
    create: '创建房间',
    join: '加入房间',
    createName: '房间名称',
    joinPlaceholder: '如 A3B7K9',
    createBtn: '创建并进入',
    joinBtn: '加入房间',
    online: '在线',
    leave: '退出',
    reconnecting: '重连中...',
    disconnected: '已断开',
    empty: '还没有消息，说点什么吧',
    roomCode: '房间代码',
    copy: '复制',
    copied: '已复制',
    copyHint: '点击复制房间代码',
  },
  message: {
    placeholder: '说点什么...',
    send: '发送',
    destroyed: '已焚毁',
    burned: '已焚',
    recall: '撤回',
  },
  burn: {
    persist: '永久',
    readOnce: '阅后即焚',
    timed: '定时',
    timer10s: '10秒',
    timer30s: '30秒',
    timer1m: '1分钟',
    timer5m: '5分钟',
    timer10m: '10分钟',
  },
  backup: {
    title: '数据备份',
    export: '导出备份',
    import: '导入备份',
    exporting: '导出中...',
    importing: '导入中...',
    exportSuccess: '导出成功！文件已下载',
    importSuccess: '导入成功！',
    exportFailed: '导出失败',
    importFailed: '导入失败',
    close: '关闭',
    rooms: '个房间',
    messages: '条消息',
  },
  nav: {
    switchLang: 'English',
  },
}

export type Translations = typeof zh
export default zh
