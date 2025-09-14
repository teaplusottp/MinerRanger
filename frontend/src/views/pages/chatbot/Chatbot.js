import React, { useState, useEffect } from 'react'
import {
  CButton,
  CForm,
  CFormInput,
  CRow,
  CCol
} from '@coreui/react'

const Chatbot = () => {
  const [messages, setMessages] = useState([
    { from: 'bot', text: 'Xin chào! Tôi có thể giúp gì cho bạn?' },
  ])
  const [input, setInput] = useState('')
  const [history, setHistory] = useState([])
  const [groups, setGroups] = useState({})

  // Lấy dữ liệu sidebar từ backend
  useEffect(() => {
    fetch('http://localhost:5000/api/sidebar')
      .then((res) => res.json())
      .then((data) => {
        setHistory(data.history || [])
        setGroups(data.groups || {})
      })
      .catch((err) => console.error('Error fetch sidebar:', err))
  }, [])

  const sendMessage = () => {
    if (!input.trim()) return
    const newMessages = [...messages, { from: 'user', text: input }]
    setMessages(newMessages)
    setInput('')

    // giả lập bot trả lời
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { from: 'bot', text: 'Tôi đang xử lý: ' + input },
      ])
    }, 800)
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
          overflowY: 'auto'
        }}
      >
        <h5 style={{ color: '#aaa' }}>Lịch sử chat</h5>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {history.map((item, idx) => (
            <li
              key={idx}
              style={{
                padding: '10px',
                margin: '5px 0',
                borderRadius: '8px',
                backgroundColor: '#2a2a2a',
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
          onClick={() =>
            setHistory([...history, `Cuộc trò chuyện ${history.length + 1}`])
          }
        >
          + Cuộc trò chuyện mới
        </CButton>

        {/* Render groups + datasets */}
        {Object.entries(groups).map(([groupName, datasets]) => (
          <div key={groupName} style={{ marginTop: '20px' }}>
            <h6 style={{ color: '#aaa' }}>{groupName}</h6>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {datasets.map((ds, idx) => (
                <li
                  key={idx}
                  style={{
                    padding: '8px',
                    margin: '4px 0',
                    borderRadius: '6px',
                    backgroundColor: '#2a2a2a',
                    cursor: 'pointer',
                  }}
                >
                  {ds}
                </li>
              ))}
            </ul>
          </div>
        ))}
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
