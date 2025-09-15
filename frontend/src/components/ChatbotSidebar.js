import React from 'react'

const ChatbotSidebar = ({ isOpen, onClose }) => {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: isOpen ? 0 : '-340px',
        width: '340px',
        height: '100vh',
        background: '#1e1e1e',   // nền tối
        borderLeft: '1px solid #333',
        boxShadow: '-2px 0 8px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'right 0.3s ease',
        zIndex: 1050,
        color: '#fff',
      }}
    >
      {/* Header */}
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
        🤖 Chatbot
        <button
          onClick={onClose}
          style={{
            background: '#c0392b',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '2px 8px',
            cursor: 'pointer',
          }}
        >
          X
        </button>
      </div>

      {/* Body tin nhắn */}
      <div
        style={{
          flex: 1,
          padding: '10px',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            background: '#2c2c2c',
            padding: '6px 10px',
            borderRadius: '6px',
            marginBottom: '8px',
            maxWidth: '80%',
          }}
        >
          Xin chào 👋, mình có thể giúp gì?
        </div>
      </div>

      {/* Input chat */}
      <div style={{ padding: '10px', borderTop: '1px solid #333' }}>
        <input
          type="text"
          placeholder="Nhập tin nhắn..."
          style={{
            width: '100%',
            padding: '8px',
            borderRadius: '4px',
            border: '1px solid #555',
            background: '#2c2c2c',
            color: '#fff',
          }}
        />
      </div>
    </div>
  )
}

export default ChatbotSidebar
