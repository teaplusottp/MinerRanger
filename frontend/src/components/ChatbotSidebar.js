import React, { useState, useEffect } from "react"

const ChatbotSidebar = ({ isOpen, onClose }) => {
  const [message, setMessage] = useState("")
  const [chat, setChat] = useState([])
  const [chatList, setChatList] = useState([])
  const [currentChatId, setCurrentChatId] = useState(null)

  // load danh sách chat khi mở
  useEffect(() => {
    if (isOpen) {
      fetch("http://localhost:8000/chats")
        .then((res) => res.json())
        .then((data) => {
          setChatList(data)
          if (data.length > 0) {
            setCurrentChatId(data[0].id)
            loadChatHistory(data[0].id)
          }
        })
    }
  }, [isOpen])

  const loadChatHistory = async (chatId) => {
    const res = await fetch(`http://localhost:8000/chats/${chatId}`)
    const data = await res.json()
    setChat(data.messages)
  }

  const createNewChat = async () => {
    const res = await fetch("http://localhost:8000/chats", {
      method: "POST",
    })
    const data = await res.json()
    setChatList((prev) => [...prev, data])
    setCurrentChatId(data.id)
    setChat([])
  }

  const deleteChat = async (chatId) => {
    await fetch(`http://localhost:8000/chats/${chatId}`, { method: "DELETE" })
    setChatList((prev) => prev.filter((c) => c.id !== chatId))
    if (currentChatId === chatId) {
      setCurrentChatId(null)
      setChat([])
    }
  }

  const sendMessage = async () => {
    if (!message.trim() || !currentChatId) return

    setChat((prev) => [...prev, { role: "user", text: message }])

    try {
      const res = await fetch(`http://localhost:8000/chats/${currentChatId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      })
      const data = await res.json()
      setChat((prev) => [...prev, { role: "bot", text: data.reply }])
    } catch (err) {
      console.error(err)
    }

    setMessage("")
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: isOpen ? 0 : "-340px",
        width: "340px",
        height: "100vh",
        background: "#1e1e1e",
        borderLeft: "1px solid #333",
        boxShadow: "-2px 0 8px rgba(0,0,0,0.5)",
        display: "flex",
        flexDirection: "column",
        transition: "right 0.3s ease",
        zIndex: 1050,
        color: "#fff",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px",
          borderBottom: "1px solid #333",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontWeight: "bold",
        }}
      >
        🤖 Chatbot
        <button
          onClick={onClose}
          style={{
            background: "#c0392b",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            padding: "2px 8px",
            cursor: "pointer",
          }}
        >
          X
        </button>
      </div>

      {/* Dropdown chọn chat */}
      <div
        style={{
          display: "flex",
          gap: "6px",
          padding: "10px",
          borderBottom: "1px solid #333",
        }}
      >
        <select
          value={currentChatId || ""}
          onChange={(e) => {
            setCurrentChatId(Number(e.target.value))
            loadChatHistory(Number(e.target.value))
          }}
          style={{
            flex: 1,
            padding: "6px",
            borderRadius: "4px",
            background: "#2c2c2c",
            color: "#fff",
            border: "1px solid #555",
          }}
        >
          {chatList.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          onClick={createNewChat}
          style={{
            background: "#27ae60",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            padding: "0 10px",
            cursor: "pointer",
          }}
        >
          +
        </button>
        <button
          onClick={() => deleteChat(currentChatId)}
          style={{
            background: "#e74c3c",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            padding: "0 10px",
            cursor: "pointer",
          }}
        >
          🗑
        </button>
      </div>

      {/* Body tin nhắn */}
      <div
        style={{
          flex: 1,
          padding: "10px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {chat.map((c, i) => (
          <div
            key={i}
            style={{
              alignSelf: c.role === "bot" ? "flex-start" : "flex-end",
              background: c.role === "bot" ? "#2c2c2c" : "#3498db",
              color: "#fff",
              padding: "6px 10px",
              borderRadius: "6px",
              marginBottom: "8px",
              maxWidth: "80%",
            }}
          >
            {c.text}
          </div>
        ))}
      </div>

      {/* Input + send */}
      <div
        style={{
          padding: "10px",
          borderTop: "1px solid #333",
          display: "flex",
          gap: "6px",
        }}
      >
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Nhập tin nhắn..."
          style={{
            flex: 1,
            padding: "8px",
            borderRadius: "4px",
            border: "1px solid #555",
            background: "#2c2c2c",
            color: "#fff",
          }}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button
          onClick={sendMessage}
          style={{
            background: "#2980b9",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            padding: "0 12px",
            cursor: "pointer",
          }}
        >
          Gửi
        </button>
      </div>
    </div>
  )
}

export default ChatbotSidebar
