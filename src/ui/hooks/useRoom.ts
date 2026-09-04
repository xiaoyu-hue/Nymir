import { useState, useEffect } from 'react'
import { roomManager } from '../../core/room'

export function useRoom() {
  const [inRoom, setInRoom] = useState(roomManager.inRoom)
  const [room, setRoom] = useState(roomManager.room)

  useEffect(() => {
    const unsub = roomManager.onEvent((event) => {
      if (event === 'room:joined' || event === 'room:left') {
        setInRoom(roomManager.inRoom)
        setRoom(roomManager.room)
      }
    })

    setInRoom(roomManager.inRoom)
    setRoom(roomManager.room)

    return unsub
  }, [])

  return { inRoom, room }
}
