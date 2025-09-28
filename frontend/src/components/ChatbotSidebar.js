import React, { useEffect, useMemo, useRef, useState } from 'react'

import { askChatbot, extractChatbotError } from '../services/chatbotService'

const createTimestamp = () => new Date().toISOString()

const ChatbotSidebar = ({ isOpen, onClose }) => {
  const sidebarRef = useRef(null)
  const nextIdRef = useRef(1)
  const [message, setMessage] = useState('')
  const [conversations, setConversations] = useState([])
  const [currentChatId, setCurrentChatId] = useState(null)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isOpen) {
      return
    }
    if (conversations.length === 0) {
      const newChatId = nextIdRef.current++
      setConversations([{ id: newChatId, name: 'Cuoc tro chuyen 1', messages: [] }])
      setCurrentChatId(newChatId)
      setMessage('')
      setError(null)
    } else if (!currentChatId) {
      setCurrentChatId(conversations[0].id)
    }
  }, [isOpen, conversations, currentChatId])

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === currentChatId) || null,
    [conversations, currentChatId],
  )

  const messages = activeConversation?.messages || []

  const handleBackdropPointerDown = (event) => {
    const sidebarEl = sidebarRef.current
    if (!sidebarEl || sidebarEl.contains(event.target)) {
      return
    }
    onClose?.()
  }

  const handleCreateNewChat = () => {
    const newChatId = nextIdRef.current++
    const name = `Cuoc tro chuyen ${conversations.length + 1}`
    setConversations((prev) => [...prev, { id: newChatId, name, messages: [] }])
    setCurrentChatId(newChatId)
    setMessage('')
    setError(null)
  }

  const handleDeleteChat = (chatId) => {
    setConversations((prev) => {
      const filtered = prev.filter((conversation) => conversation.id !== chatId)
      if (filtered.length === prev.length) {
        return prev
      }
      if (chatId === currentChatId) {
        setCurrentChatId(filtered.length ? filtered[0].id : null)
      }
      return filtered
    })
  }

  const pushMessage = (chatId, newMessage) => {
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === chatId
          ? { ...conversation, messages: [...conversation.messages, newMessage] }
          : conversation,
      ),
    )
  }

  const deriveAnswerText = (payload) => {
    if (!payload) {
      return ''
    }
    if (typeof payload.answer === 'string' && payload.answer.trim().length) {
      return payload.answer.trim()
    }
    if (typeof payload === 'string' && payload.trim().length) {
      return payload.trim()
    }
    return JSON.stringify(payload)
  }

  const handleSendMessage = async () => {
    const trimmed = message.trim()
    if (!trimmed) {
      return
    }

    let chatId = currentChatId
    if (!chatId) {
      chatId = nextIdRef.current++
      const name = `Cuoc tro chuyen ${conversations.length + 1 || 1}`
      setConversations((prev) => [...prev, { id: chatId, name, messages: [] }])
      setCurrentChatId(chatId)
    }

    const userMessage = { role: 'user', text: trimmed, timestamp: createTimestamp() }
    pushMessage(chatId, userMessage)
    setMessage('')
    setIsSending(true)
    setError(null)

    try {
      const response = await askChatbot(trimmed)
      const botMessage = {
        role: 'bot',
        text: deriveAnswerText(response),
        raw: response,
        timestamp: createTimestamp(),
      }
      pushMessage(chatId, botMessage)
    } catch (err) {
      const errorMessage = extractChatbotError(err)
      pushMessage(chatId, { role: 'error', text: errorMessage, timestamp: createTimestamp() })
      setError(errorMessage)
    } finally {
      setIsSending(false)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!isSending) {
      handleSendMessage()
    }
  }

  return (
    <div
      role="presentation"
      aria-hidden={!isOpen}
      onMouseDown={handleBackdropPointerDown}
      onTouchStart={handleBackdropPointerDown}
      style={{
        position: 'fixed',
        inset: 0,
        background: isOpen ? 'rgba(0, 0, 0, 0.2)' : 'transparent',
        transition: 'background 0.3s ease',
        pointerEvents: isOpen ? 'auto' : 'none',
        zIndex: 1049,
      }}
    >
      <div
        ref={sidebarRef}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '340px',
          height: '100vh',
          background: '#1e1e1e',
          borderLeft: '1px solid #333',
          boxShadow: '-2px 0 8px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'transform 0.3s ease',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          color: '#fff',
        }}
      >
        <div
          style={{
            padding: '12px',
            borderBottom: '1px solid #333',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontWeight: 'bold',
          }}
        >
          AI Chatbot
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#c0392b',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              padding: '6px 12px',
              cursor: 'pointer',
            }}
          >
            Dong
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '6px',
            padding: '10px',
            borderBottom: '1px solid #333',
          }}
        >
          <select
            value={currentChatId || ''}
            onChange={(event) => setCurrentChatId(Number(event.target.value))}
            style={{
              flex: 1,
              padding: '6px',
              borderRadius: '4px',
              background: '#2c2c2c',
              color: '#fff',
              border: '1px solid #555',
            }}
          >
            {conversations.map((conversation) => (
              <option key={conversation.id} value={conversation.id}>
                {conversation.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleCreateNewChat}
            style={{
              background: '#27ae60',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              padding: '0 10px',
              cursor: 'pointer',
            }}
          >
            +
          </button>
          <button
            type="button"
            onClick={() => handleDeleteChat(currentChatId)}
            style={{
              background: '#e74c3c',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              padding: '0 10px',
              cursor: currentChatId ? 'pointer' : 'not-allowed',
              opacity: currentChatId ? 1 : 0.5,
            }}
            disabled={!currentChatId}
          >
            Del
          </button>
        </div>

        <div
          style={{
            flex: 1,
            padding: '10px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {messages.map((item, index) => {
            const alignment = item.role === 'bot' ? 'flex-start' : item.role === 'error' ? 'center' : 'flex-end'
            const background =
              item.role === 'bot'
                ? '#2c2c2c'
                : item.role === 'error'
                ? '#8e1b1b'
                : '#3498db'
            return (
              <div
                key={`${item.role}-${index}-${item.timestamp || index}`}
                style={{
                  alignSelf: alignment,
                  background,
                  color: '#fff',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  maxWidth: '80%',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {item.text}
              </div>
            )
          })}
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            padding: '10px',
            borderTop: '1px solid #333',
            display: 'flex',
            gap: '6px',
          }}
        >
          <input
            type="text"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Nhap tin nhan..."
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #555',
              background: '#2c2c2c',
              color: '#fff',
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                if (!isSending) {
                  handleSendMessage()
                }
              }
            }}
          />
          <button
            type="submit"
            disabled={isSending}
            style={{
              background: isSending ? '#555' : '#2980b9',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              padding: '0 12px',
              cursor: isSending ? 'not-allowed' : 'pointer',
            }}
          >
            {isSending ? '...' : 'Gui'}
          </button>
        </form>

        {error ? (
          <div
            style={{
              padding: '8px 12px',
              color: '#f5c542',
              background: '#3a2d0a',
              borderTop: '1px solid #555',
            }}
          >
            {error}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default ChatbotSidebar
