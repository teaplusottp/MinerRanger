import axios from 'axios'
import { resolveAuthBaseUrl } from './authService'

const userClient = axios.create({
  baseURL: resolveAuthBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false,
})

const mapProfileResponse = (data = {}) => ({
  id: data.id ?? data._id ?? '',
  username: data.username ?? '',
  email: data.email ?? '',
  firstName: data.firstName ?? '',
  lastName: data.lastName ?? '',
  telNumber: data.telNumber ?? '',
  gender: data.gender ?? '',
  avatar: data.avatar ?? '',
  createdAt: data.createdAt ?? '',
})

export const getUserProfile = async (token) => {
  const response = await userClient.get('/me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  return mapProfileResponse(response.data)
}

export const updateUserProfile = async (token, payload) => {
  const response = await userClient.patch('/profile', payload, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  const profile = mapProfileResponse(response.data)
  return {
    ...profile,
    passwordChanged: Boolean(response.data?.passwordChanged),
  }
}

export const uploadUserAvatar = async (token, file) => {
  const formData = new FormData()
  formData.append('avatar', file)
  const response = await userClient.post('/avatar', formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data',
    },
  })
  return mapProfileResponse(response.data)
}
