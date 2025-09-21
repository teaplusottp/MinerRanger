import axios from 'axios'

const DEFAULT_BASE_URL = 'http://localhost:8080/api/users'

const resolveBaseUrl = () => {
  const fromEnv = import.meta.env?.VITE_AUTH_API_BASE_URL
  const base = fromEnv && typeof fromEnv === 'string' && fromEnv.trim().length ? fromEnv.trim() : DEFAULT_BASE_URL
  return base.endsWith('/') ? base.slice(0, -1) : base
}

const authClient = axios.create({
  baseURL: resolveBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false,
})

export const loginUser = async ({ email, password }) => {
  const response = await authClient.post('/login', { email, password })
  return response.data
}

export const registerUser = async ({ username, email, password }) => {
  const response = await authClient.post('/register', { username, email, password })
  return response.data
}

export const extractErrorMessage = (error, fallback = 'Unable to complete the request') => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data
    if (data) {
      if (typeof data === 'string') {
        return data
      }
      if (typeof data.message === 'string' && data.message.trim().length) {
        return data.message
      }
      if (typeof data.error === 'string' && data.error.trim().length) {
        return data.error
      }
    }
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}
