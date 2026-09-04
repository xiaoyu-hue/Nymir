import { useState, useEffect } from 'react'
import { roomManager, type ConnectionStatus } from '../../core/room'
import type { RoomInfo } from '../../core/types'

interface RoomState {
  inRoom: boolean
  room: RoomInfo | null
  status: ConnectionStatus
}

export function useRoom() {
  const [state, setState] = useState<RoomState>(() => ({
    inRoom: roomManager.inRoom,
    room: roomManager.room,
    status: roomManager.status,
  }))

  useEffect(() => {
    const unsub = roomManager.onEvent((event, data) => {
      if (event === 'room:joined' || event === 'room:left') {
        setState((prev) => ({
          ...prev,
          inRoom: roomManager.inRoom,
          room: roomManager.room,
        }))
      }
      if (event === 'status:change') {
        setState((prev) => ({
          ...prev,
          status: data as ConnectionStatus,
        }))
      }
    })
    return unsub
  }, [])

  return state
}
