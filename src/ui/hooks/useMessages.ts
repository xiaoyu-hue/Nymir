import { useState, useEffect } from 'react'
import type { Message } from '../../core/types'
import { messageManager } from '../../core/message'

export function useMessages() {
  const [messages, setMessages] = useState<Message[]>(() =>
    messageManager.getMessages(),
  )

  useEffect(() => {
    const unsub = messageManager.onMessage(() => {
      setMessages(messageManager.getMessages())
    })
    return unsub
  }, [])

  return messages
}
