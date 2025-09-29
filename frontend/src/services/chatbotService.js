import axios from 'axios'

const DEFAULT_CHATBOT_BASE_URL = 'http://localhost:8000'

export const resolveChatbotBaseUrl = () => {
  const fromEnv = import.meta?.env?.VITE_CHATBOT_API_BASE_URL
  const base = typeof fromEnv === 'string' && fromEnv.trim().length ? fromEnv.trim() : DEFAULT_CHATBOT_BASE_URL
  return base.endsWith('/') ? base.slice(0, -1) : base
}

const AUTH_TOKEN_KEY = 'minerranger.authToken'

const chatbotClient = axios.create({
  baseURL: resolveChatbotBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false,
})

const resolveAuthToken = () => {
  if (typeof window === 'undefined') {
    return ''
  }
  try {
    const token = window.localStorage.getItem(AUTH_TOKEN_KEY)
    return typeof token === 'string' ? token.trim() : ''
  } catch (error) {
    return ''
  }
}

export const askChatbot = async ({ question, datasetId, sessionId, summary }) => {
  const trimmedQuestion = typeof question === 'string' ? question.trim() : ''
  if (!trimmedQuestion.length) {
    throw new Error('Question must not be empty.')
  }

  const trimmedDatasetId = typeof datasetId === 'string' ? datasetId.trim() : ''
  if (!trimmedDatasetId.length) {
    throw new Error('datasetId is required.')
  }

  const authToken = resolveAuthToken()
  if (!authToken.length) {
    throw new Error('Vui long dang nhap de su dung chatbot.')
  }

  const payload = {
    question: trimmedQuestion,
    datasetId: trimmedDatasetId,
  }

  if (typeof sessionId === 'string') {
    const trimmedSession = sessionId.trim()
    if (trimmedSession.length) {
      payload.sessionId = trimmedSession
    }
  }

  if (typeof summary === 'string') {
    const trimmedSummary = summary.trim()
    if (trimmedSummary.length) {
      payload.summary = trimmedSummary
    }
  }

  const response = await chatbotClient.post('/api/chatbot/query', payload, {
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  })
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
