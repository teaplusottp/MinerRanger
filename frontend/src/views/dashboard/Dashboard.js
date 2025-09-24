import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { CAlert, CCard, CCardBody, CCardHeader } from '@coreui/react'
import GraphView from '../../components/fetch/GraphView'

const AUTH_TOKEN_KEY = 'minerranger.authToken'
const AUTH_USER_KEY = 'minerranger.user'

const Dashboard = () => {
  const navigate = useNavigate()
  const [dashboardData, setDashboardData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const fetchDashboard = useCallback(async () => {
    let token = null
    try {
      token = window.localStorage.getItem(AUTH_TOKEN_KEY)
    } catch (storageError) {
      token = null
    }

    if (!token) {
      setDashboardData(null)
      setIsLoading(false)
      setErrorMessage('Authentication required. Please log in again.')
      navigate('/login', { replace: true })
      return
    }

    try {
      setIsLoading(true)
      setErrorMessage('')
      const response = await axios.get('/api/users/dashboard', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      setDashboardData(response.data)
    } catch (error) {
      const message =
        error.response?.data?.message || 'Unable to load dashboard data right now.'
      setDashboardData(null)
      setErrorMessage(message)
      if (error.response?.status === 401) {
        try {
          window.localStorage.removeItem(AUTH_TOKEN_KEY)
          window.localStorage.removeItem(AUTH_USER_KEY)
        } catch (storageError) {
          // ignore storage issues
        }
        navigate('/login', { replace: true })
      }
    } finally {
      setIsLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  useEffect(() => {
    const handleLogoutClick = (event) => {
      const target = event.target
      const logoutButton = target?.closest('.users-menu__item')
      if (!logoutButton) {
        return
      }

      if (logoutButton.textContent?.trim().toLowerCase() === 'log out') {
        try {
          window.localStorage.removeItem(AUTH_TOKEN_KEY)
          window.localStorage.removeItem(AUTH_USER_KEY)
        } catch (storageError) {
          // ignore storage issues
        }
        navigate('/home', { replace: true })
      }
    }

    document.addEventListener('click', handleLogoutClick, true)
    return () => {
      document.removeEventListener('click', handleLogoutClick, true)
    }
  }, [navigate])

  const headerMessage = () => {
    if (isLoading) {
      return 'Loading dashboard...'
    }
    if (dashboardData?.message) {
      return dashboardData.message
    }
    return 'Dashboard'
  }

  return (
    <>
      <CCard className="mb-4">
        <CCardHeader>{headerMessage()}</CCardHeader>
        <CCardBody>
          {errorMessage ? (
            <CAlert color="danger" className="mb-3">
              {errorMessage}
            </CAlert>
          ) : null}

          {dashboardData?.user ? (
            <CAlert color="info" className="mb-3">
              Signed in as{' '}
              {dashboardData.user.username || dashboardData.user.email || 'current user'}
            </CAlert>
          ) : null}

          <GraphView />
        </CCardBody>
      </CCard>
    </>
  )
}

export default Dashboard
