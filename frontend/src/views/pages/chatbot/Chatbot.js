import React, { useState, useEffect } from 'react'
import {
  CButton,
  CForm,
  CFormInput,
  CRow,
  CCol
} from '@coreui/react'

const Chatbot = () => {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [history, setHistory] = useState([])
  const [datasets, setDatasets] = useState([])
  const [currentChat, setCurrentChat] = useState({ category: 'Chat', name: 'Cuộc trò chuyện 1' })

  // Lấy sidebar (datasets + history)
  useEffect(() => {
    fetch('http://localhost:8000/api/sidebar')
      .then((res) => res.json())
      .then((data) => {
        setHistory(data.history || [])
        if (data.groups && data.groups.Datasets) {
          setDatasets(data.groups.Datasets)
        }
      })
      .catch((err) => console.error('Error fetch sidebar:', err))
  }, [])

  // Lấy messages khi đổi cuộc trò chuyện hoặc dataset
  useEffect(() => {
    if (!currentChat.category || !currentChat.name) return
    fetch(`http://localhost:8000/api/messages/${currentChat.category}/${encodeURIComponent(currentChat.name)}`)
      .then((res) => res.json())
      .then((data) => {
        setMessages(data.messages || [])
      })
      .catch((err) => console.error('Error fetch messages:', err))
  }, [currentChat])

  const sendMessage = () => {
    if (!input.trim()) return

    fetch(`http://localhost:8000/api/chat/send?category=${currentChat.category}&name=${encodeURIComponent(currentChat.name)}&text=${encodeURIComponent(input)}`, {
      method: "POST"
    })
      .then(res => res.json())
      .then(data => {
        setMessages(data.messages) // cập nhật toàn bộ history từ backend
        setInput('')
      })
      .catch(err => console.error('Error send message:', err))
  }

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        backgroundColor: '#121212',
        color: '#fff',
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          width: '250px',
          borderRight: '1px solid #333',
          padding: '15px',
          backgroundColor: '#1e1e1e',
          overflowY: 'auto',
        }}
      >
        {/* Datasets */}
        <div style={{ marginBottom: '20px' }}>
          <h6 style={{ color: '#aaa' }}>Datasets</h6>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {datasets.map((ds, idx) => (
              <li
                key={idx}
                onClick={() => setCurrentChat({ category: 'Dataset', name: ds })}
                style={{
                  padding: '8px',
                  margin: '4px 0',
                  borderRadius: '6px',
                  backgroundColor: currentChat.name === ds && currentChat.category === 'Dataset' ? '#0d6efd' : '#2a2a2a',
                  cursor: 'pointer',
                }}
              >
                {ds}
              </li>
            ))}
          </ul>
        </div>

        {/* History */}
        <h5 style={{ color: '#aaa' }}>Lịch sử chat</h5>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {history.map((item, idx) => (
            <li
              key={idx}
              onClick={() => setCurrentChat({ category: 'Chat', name: item })}
              style={{
                padding: '10px',
                margin: '5px 0',
                borderRadius: '8px',
                backgroundColor: currentChat.name === item && currentChat.category === 'Chat' ? '#0d6efd' : '#2a2a2a',
                cursor: 'pointer',
              }}
            >
              {item}
            </li>
          ))}
        </ul>
        <CButton
          color="secondary"
          className="w-100 mt-3"
          onClick={() => {
            const newChat = `Cuộc trò chuyện ${history.length + 1}`
            setHistory([...history, newChat])
            setCurrentChat({ category: 'Chat', name: newChat })
          }}
        >
          + Cuộc trò chuyện mới
        </CButton>
      </div>

      {/* Chat chính */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
          }}
        >
          {messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                textAlign: msg.from === 'user' ? 'right' : 'left',
                margin: '8px 0',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  padding: '10px 15px',
                  borderRadius: '12px',
                  background:
                    msg.from === 'user' ? '#0d6efd' : '#2a2a2a',
                  color: msg.from === 'user' ? '#fff' : '#ddd',
                  maxWidth: '70%',
                }}
              >
                {msg.text}
              </span>
            </div>
          ))}
        </div>

        {/* Ô nhập tin nhắn */}
        <div style={{ borderTop: '1px solid #333', padding: '15px' }}>
          <CForm
            onSubmit={(e) => {
              e.preventDefault()
              sendMessage()
            }}
          >
            <CRow>
              <CCol xs={10}>
                <CFormInput
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Nhập tin nhắn..."
                  style={{
                    backgroundColor: '#1e1e1e',
                    color: '#fff',
                    border: '1px solid #444',
                  }}
                />
              </CCol>
              <CCol xs={2}>
                <CButton color="primary" className="w-100" type="submit">
                  Gửi
                </CButton>
              </CCol>
            </CRow>
          </CForm>
        </div>
      </div>
    </div>
  )
}

export default Chatbot
