import { useState, useEffect } from 'react'
import { roomManager, type ConnectionStatus } from '../../core/room'

export function useRoom() {
  const [inRoom, setInRoom] = useState(() => roomManager.inRoom)
  const [room, setRoom] = useState(() => roomManager.room)
  const [status, setStatus] = useState<ConnectionStatus>(() => roomManager.status)

  useEffect(() => {
    const unsub = roomManager.onEvent((event, data) => {
      if (event === 'room:joined' || event === 'room:left') {
        setInRoom(roomManager.inRoom)
        setRoom(roomManager.room)
      }
      if (event === 'status:change') {
        setStatus(data as ConnectionStatus)
      }
    })
    return unsub
  }, [])

  return { inRoom, room, status }
}
