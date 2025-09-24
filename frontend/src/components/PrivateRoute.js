import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'

const AUTH_TOKEN_KEY = 'minerranger.authToken'

const PrivateRoute = ({ children }) => {
  let token = null
  try {
    token = window.localStorage.getItem(AUTH_TOKEN_KEY)
  } catch (err) {
    token = null
  }

  if (!token) {
    return <Navigate to="/login" replace />
  }

  return children ? children : <Outlet />
}

export default PrivateRoute
