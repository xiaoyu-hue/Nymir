import type { Translations } from './zh'

const en: Translations = {
  app: {
    name: 'Nymir',
    subtitle: 'Anonymous Tree-Hole · Read-and-Burn · Your Data, Your Sovereignty',
    tagline: 'Your data, your sovereignty. Let secrets stay with you.',
  },
  room: {
    create: 'Create Room',
    join: 'Join Room',
    createName: 'Room Name',
    joinCode: 'Enter Room Code',
    joinPlaceholder: 'e.g. A3B7K9',
    createBtn: 'Create & Enter',
    joinBtn: 'Join Room',
    online: 'online',
    leave: 'Leave',
    reconnecting: 'Reconnecting...',
    disconnected: 'Disconnected',
    empty: 'No messages yet, say something',
    roomCode: 'Room Code',
    copy: 'Copy',
    copied: 'Copied',
    copyHint: 'Click to copy room code',
  },
  message: {
    placeholder: 'Say something...',
    send: 'Send',
    destroyed: 'Burned',
    burned: 'Burned',
    recall: 'Recall',
  },
  burn: {
    persist: 'Persistent',
    readOnce: 'Read-once',
    timed: 'Timed',
    timer10s: '10s',
    timer30s: '30s',
    timer1m: '1min',
    timer5m: '5min',
    timer10m: '10min',
  },
  backup: {
    title: 'Data Backup',
    export: 'Export Backup',
    import: 'Import Backup',
    exporting: 'Exporting...',
    importing: 'Importing...',
    exportSuccess: 'Export successful! File downloaded.',
    importSuccess: 'Import successful!',
    exportFailed: 'Export failed',
    importFailed: 'Import failed',
    close: 'Close',
    rooms: 'rooms',
    messages: 'messages',
  },
  nav: {
    switchLang: '中文',
  },
}

export default en
