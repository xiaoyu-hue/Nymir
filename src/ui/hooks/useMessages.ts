import { useState, useEffect } from 'react'
import type { Message } from '../../core/types'
import { messageManager } from '../../core/message'

export function useMessages() {
  const [messages, setMessages] = useState<Message[]>([])

  useEffect(() => {
    setMessages(messageManager.getMessages())
    const unsub = messageManager.onMessage(() => {
      setMessages(messageManager.getMessages())
    })
    return unsub
  }, [])

  return messages
}
