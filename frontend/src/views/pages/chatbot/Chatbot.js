import React, { useState } from 'react'
import {
  CButton,
  CCard,
  CCardBody,
  CCol,
  CContainer,
  CForm,
  CFormInput,
  CRow,
} from '@coreui/react'

const Chatbot = () => {
  const [messages, setMessages] = useState([
    { from: 'bot', text: 'Xin chào! Tôi có thể giúp gì cho bạn?' },
  ])
  const [input, setInput] = useState('')

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
    <div className="bg-body-tertiary min-vh-100 d-flex flex-row align-items-center">
      <CContainer>
        <CRow className="justify-content-center">
          <CCol md={8}>
            <CCard className="p-4">
              <CCardBody>
                <h2>Chatbot</h2>
                <div
                  style={{
                    height: '400px',
                    overflowY: 'auto',
                    border: '1px solid #eee',
                    padding: '10px',
                    marginBottom: '15px',
                  }}
                >
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      style={{
                        textAlign: msg.from === 'user' ? 'right' : 'left',
                        margin: '5px 0',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '8px 12px',
                          borderRadius: '10px',
                          background:
                            msg.from === 'user' ? '#0d6efd' : '#e9ecef',
                          color: msg.from === 'user' ? '#fff' : '#000',
                        }}
                      >
                        {msg.text}
                      </span>
                    </div>
                  ))}
                </div>

                <CForm
                  onSubmit={(e) => {
                    e.preventDefault()
                    sendMessage()
                  }}
                >
                  <CRow>
                    <CCol xs={9}>
                      <CFormInput
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Nhập tin nhắn..."
                      />
                    </CCol>
                    <CCol xs={3}>
                      <CButton
                        color="primary"
                        className="w-100"
                        type="submit"
                      >
                        Gửi
                      </CButton>
                    </CCol>
                  </CRow>
                </CForm>
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}

export default Chatbot
