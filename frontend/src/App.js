import React, { Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useSelector } from 'react-redux'

import { CSpinner, useColorModes } from '@coreui/react'
import './scss/style.scss'
import { DbProvider } from './context/DbContext'

// We use those styles to show code examples, you should remove them in your application.
import './scss/examples.scss'
import GuestRoute from './components/GuestRoute'

// Containers
const DefaultLayout = React.lazy(() => import('./layout/DefaultLayout'))
const Home = React.lazy(() => import('./views/home/Home'))
const Login = React.lazy(() => import('./views/auth/Login'))
const Register = React.lazy(() => import('./views/auth/Register'))
const PlaceholderPage = React.lazy(() => import('./views/marketing/PlaceholderPage'))

const App = () => {
  const { isColorModeSet, setColorMode } = useColorModes('coreui-free-react-admin-template-theme')
  const storedTheme = useSelector((state) => state.theme)

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.href.split('?')[1])
    const theme = urlParams.get('theme') && urlParams.get('theme').match(/^[A-Za-z0-9\s]+/)[0]
    if (theme) {
      setColorMode(theme)
    }

    if (isColorModeSet()) {
      return
    }

    setColorMode(storedTheme)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <DbProvider>
      <BrowserRouter>
        <Suspense
          fallback={
            <div className="pt-3 text-center">
              <CSpinner color="primary" variant="grow" />
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route element={<GuestRoute />}>
              <Route path="/home" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
            </Route>
            <Route path="/about" element={<PlaceholderPage title="About us" />} />
            <Route path="/blog" element={<PlaceholderPage title="Blog" />} />
            <Route path="/demo" element={<PlaceholderPage title="How it works" />} />
            <Route path="/*" name="App" element={<DefaultLayout />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </DbProvider>
  )
}

export default App
