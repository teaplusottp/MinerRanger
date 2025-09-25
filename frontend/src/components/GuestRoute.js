import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'

const AUTH_TOKEN_KEY = 'minerranger.authToken'

const GuestRoute = ({ children, redirectPath = '/dashboard' }) => {
  let token = null
  try {
    token = window.localStorage.getItem(AUTH_TOKEN_KEY)
  } catch (err) {
    token = null
  }

  if (token) {
    return <Navigate to={redirectPath} replace />
  }

  return children ? children : <Outlet />
}

export default GuestRoute
