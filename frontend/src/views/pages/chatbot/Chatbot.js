import React, { useEffect, useMemo, useRef, useState } from 'react'
import { CAlert, CButton, CForm, CFormInput } from '@coreui/react'

import { useDb } from '../../../context/DbContext'
import { askChatbot, extractChatbotError } from '../../../services/chatbotService'

const createTimestamp = () => new Date().toISOString()

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

const sanitizeSummary = (value, fallback = '') => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.length) {
      return trimmed
    }
  }
  return fallback
}

const createConversationRecord = (id, name, datasetId = '') => ({
  id,
  name,
  datasetId,
  sessionId: null,
  session: null,
  summary: name,
  messages: [],
})

const Chatbot = () => {
  const { selectedDb } = useDb()
  const nextIdRef = useRef(1)
  const scrollRef = useRef(null)
  const [conversations, setConversations] = useState([])
  const [currentChatId, setCurrentChatId] = useState(null)
  const [inputValue, setInputValue] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (conversations.length === 0) {
      const newChatId = nextIdRef.current++
      setConversations([createConversationRecord(newChatId, 'Cuoc tro chuyen 1')])
      setCurrentChatId(newChatId)
    } else if (!currentChatId) {
      setCurrentChatId(conversations[0].id)
    }
  }, [conversations, currentChatId])

  const currentConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === currentChatId) || null,
    [conversations, currentChatId],
  )

  const messages = currentConversation?.messages || []

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const pushMessage = (chatId, newMessage, baseConversation) => {
    setConversations((prev) => {
      const existing = prev.find((conversation) => conversation.id === chatId)
      const target = existing || baseConversation
      if (!target) {
        return prev
      }
      const updated = {
        ...target,
        messages: [...(target.messages || []), newMessage],
      }
      if (existing) {
        return prev.map((conversation) => (conversation.id === chatId ? updated : conversation))
      }
      return [...prev, updated]
    })
  }

  const updateConversation = (chatId, producer) => {
    setConversations((prev) =>
      prev.map((conversation) => {
        if (conversation.id !== chatId) {
          return conversation
        }
        const nextConversation = producer(conversation)
        return nextConversation || conversation
      }),
    )
  }

  const handleSelectConversation = (conversationId) => {
    setCurrentChatId(conversationId)
    setError(null)
  }

  const handleCreateConversation = () => {
    const newChatId = nextIdRef.current++
    const name = `Cuoc tro chuyen ${conversations.length + 1}`
    const datasetId = typeof selectedDb === 'string' ? selectedDb.trim() : ''
    const newConversation = createConversationRecord(newChatId, name, datasetId)
    setConversations((prev) => [...prev, newConversation])
    setCurrentChatId(newChatId)
    setInputValue('')
    setError(null)
  }

  const handleDeleteConversation = (conversationId) => {
    setConversations((prev) => {
      const filtered = prev.filter((conversation) => conversation.id !== conversationId)
      if (filtered.length === prev.length) {
        return prev
      }
      if (conversationId === currentChatId) {
        setCurrentChatId(filtered.length ? filtered[0].id : null)
      }
      return filtered
    })
  }

  const handleSendMessage = async () => {
    const trimmed = inputValue.trim()
    if (!trimmed) {
      return
    }

    const activeDatasetId = typeof selectedDb === 'string' ? selectedDb.trim() : ''
    if (!activeDatasetId.length) {
      setError('Vui long chon dataset truoc khi tro chuyen.')
      return
    }

    let chatId = currentChatId
    let conversationRecord = currentConversation

    if (!chatId || !conversationRecord) {
      chatId = nextIdRef.current++
      const name = `Cuoc tro chuyen ${conversations.length + 1 || 1}`
      conversationRecord = createConversationRecord(chatId, name, activeDatasetId)
      setCurrentChatId(chatId)
    } else if ((conversationRecord.datasetId || '').trim() !== activeDatasetId) {
      conversationRecord = { ...conversationRecord, datasetId: activeDatasetId }
      updateConversation(chatId, (existing) => ({ ...existing, datasetId: activeDatasetId }))
    }

    const userMessage = { role: 'user', text: trimmed, timestamp: createTimestamp() }
    pushMessage(chatId, userMessage, conversationRecord)
    setInputValue('')
    setIsSending(true)
    setError(null)

    try {
      const response = await askChatbot({
        question: trimmed,
        datasetId: conversationRecord.datasetId || activeDatasetId,
        sessionId: conversationRecord.sessionId,
        summary: conversationRecord.summary || conversationRecord.name,
      })
      const nextSummary = sanitizeSummary(
        response?.session?.summary,
        conversationRecord.summary || conversationRecord.name,
      )
      const nextSessionId =
        typeof response?.sessionId === 'string' && response.sessionId.trim().length
          ? response.sessionId
          : conversationRecord.sessionId

      updateConversation(chatId, (existing) => ({
        ...existing,
        datasetId: conversationRecord.datasetId || activeDatasetId,
        sessionId: nextSessionId,
        session: response?.session || existing.session,
        summary: nextSummary,
      }))

      pushMessage(chatId, {
        role: 'bot',
        text: deriveAnswerText(response),
        raw: response,
        timestamp: createTimestamp(),
      })
    } catch (err) {
      const message = extractChatbotError(err)
      pushMessage(chatId, { role: 'error', text: message, timestamp: createTimestamp() })
      setError(message)
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
      style={{
        display: 'flex',
        height: '100vh',
        backgroundColor: '#0f172a',
        color: '#fff',
      }}
    >
      <aside
        style={{
          width: '280px',
          borderRight: '1px solid #1f2937',
          display: 'flex',
          flexDirection: 'column',
          padding: '16px',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          <CButton color="primary" className="flex-grow-1" onClick={handleCreateConversation}>
            Cuoc tro chuyen moi
          </CButton>
          <CButton
            color="danger"
            variant="outline"
            disabled={!currentChatId}
            onClick={() => currentChatId && handleDeleteConversation(currentChatId)}
          >
            Xoa
          </CButton>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {conversations.map((conversation) => {
            const isActive = conversation.id === currentChatId
            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => handleSelectConversation(conversation.id)}
                style={{
                  textAlign: 'left',
                  background: isActive ? '#2563eb' : '#1f2937',
                  color: '#fff',
                  padding: '10px 12px',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                {conversation.name}
              </button>
            )
          })}
        </div>
      </aside>
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            padding: '24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {messages.map((item, index) => {
            const alignment = item.role === 'bot' ? 'flex-start' : item.role === 'error' ? 'center' : 'flex-end'
            const background =
              item.role === 'bot'
                ? '#1f2937'
                : item.role === 'error'
                ? '#991b1b'
                : '#2563eb'
            return (
              <div
                key={`${item.role}-${index}-${item.timestamp || index}`}
                style={{
                  alignSelf: alignment,
                  background,
                  color: '#fff',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  maxWidth: '70%',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {item.text}
              </div>
            )
          })}
        </div>
        <div style={{ padding: '16px', borderTop: '1px solid #1f2937' }}>
          <CForm onSubmit={handleSubmit}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <CFormInput
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder="Nhap cau hoi..."
                style={{
                  flex: 1,
                  backgroundColor: '#111827',
                  color: '#fff',
                  border: '1px solid #1f2937',
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
              <CButton color="primary" type="submit" disabled={isSending}>
                {isSending ? 'Dang gui...' : 'Gui'}
              </CButton>
            </div>
          </CForm>
          {error ? (
            <CAlert color="warning" className="mt-3">
              {error}
            </CAlert>
          ) : null}
        </div>
      </main>
    </div>
  )
}

export default Chatbot
