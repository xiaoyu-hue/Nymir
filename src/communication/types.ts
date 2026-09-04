export interface PeerEvents {
  'peer:join': (peerId: string) => void
  'peer:leave': (peerId: string) => void
}

export interface Channel<T> {
  send: (data: T, target?: string) => void
  onMessage: (cb: (data: T, info: { peerId: string }) => void) => void
}
