import axios from 'axios'

const DEFAULT_BASE_URL = 'http://localhost:8080/api/auth'

const resolvePasswordResetBaseUrl = () => {
  const fromEnv = import.meta?.env?.VITE_PASSWORD_RESET_API_BASE_URL
  const candidate = typeof fromEnv === 'string' && fromEnv.trim().length ? fromEnv.trim() : DEFAULT_BASE_URL
  return candidate.endsWith('/') ? candidate.slice(0, -1) : candidate
}

const passwordResetClient = axios.create({
  baseURL: resolvePasswordResetBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false,
})

export const requestPasswordResetOtp = async ({ email }) => {
  const response = await passwordResetClient.post('/request-otp', { email })
  return response.data
}

export const verifyPasswordResetOtp = async ({ email, otp }) => {
  const response = await passwordResetClient.post('/verify-otp', { email, otp })
  return response.data
}

export const resetPasswordWithOtp = async ({ email, otp, password }) => {
  const response = await passwordResetClient.post('/reset-password', { email, otp, password })
  return response.data
}
