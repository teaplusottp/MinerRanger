import axios from 'axios'

const DEFAULT_CHATBOT_BASE_URL = 'http://localhost:8000'

export const resolveChatbotBaseUrl = () => {
  const fromEnv = import.meta?.env?.VITE_CHATBOT_API_BASE_URL
  const base = typeof fromEnv === 'string' && fromEnv.trim().length ? fromEnv.trim() : DEFAULT_CHATBOT_BASE_URL
  return base.endsWith('/') ? base.slice(0, -1) : base
}

const chatbotClient = axios.create({
  baseURL: resolveChatbotBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false,
})

export const askChatbot = async (question) => {
  const response = await chatbotClient.post('/api/chatbot/query', { question })
  return response.data
}

export const extractChatbotError = (error, fallback = 'Không thể kết nối chatbot') => {
  if (axios.isAxiosError?.(error)) {
    const data = error.response?.data
    if (typeof data === 'string' && data.trim().length) {
      return data
    }
    if (data && typeof data.detail === 'string' && data.detail.trim().length) {
      return data.detail
    }
    if (data && typeof data.message === 'string' && data.message.trim().length) {
      return data.message
    }
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}
