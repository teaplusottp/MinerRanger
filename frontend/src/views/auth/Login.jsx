import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from './AuthLayout'
import styles from './AuthLayout.module.scss'
import authIllustration from '../../../../design/Hero-Wrapper__image--center.png'
import { extractErrorMessage, loginUser } from '../../services/authService'

const AUTH_IMAGE_SRC = authIllustration
const REMEMBER_EMAIL_KEY = 'minerranger.rememberEmail'
const AUTH_TOKEN_KEY = 'minerranger.authToken'
const AUTH_USER_KEY = 'minerranger.user'

const Login = () => {
  const navigate = useNavigate()
  const [formState, setFormState] = useState({
    email: '',
    password: '',
    remember: false,
  })
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    try {
      const storedEmail = window.localStorage.getItem(REMEMBER_EMAIL_KEY)
      if (storedEmail) {
        setFormState((prev) => ({ ...prev, email: storedEmail, remember: true }))
      }
    } catch (storageError) {
      // ignore storage access issues
    }
  }, [])

  const handleChange = (event) => {
    const { name, type, value, checked } = event.target
    setFormState((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleForgotPassword = () => {
    setErrorMessage('')
    setStatusMessage('TODO: Implement password recovery flow')
  }

  const handleProviderRedirect = () => {
    navigate('/home')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    setStatusMessage('')

    const trimmedEmail = formState.email.trim()
    if (!trimmedEmail || !formState.password) {
      setErrorMessage('Please provide both email and password')
      return
    }

    setIsSubmitting(true)
    try {
      const payload = { email: trimmedEmail, password: formState.password }
      const data = await loginUser(payload)

      try {
        if (formState.remember) {
          window.localStorage.setItem(REMEMBER_EMAIL_KEY, trimmedEmail)
        } else {
          window.localStorage.removeItem(REMEMBER_EMAIL_KEY)
        }
        if (data?.token) {
          window.localStorage.setItem(AUTH_TOKEN_KEY, data.token)
        }
        if (data && (data.id || data.email || data.username)) {
          window.localStorage.setItem(
            AUTH_USER_KEY,
            JSON.stringify({ id: data.id, email: data.email, username: data.username })
          )
        }
      } catch (storageError) {
        // ignore storage access issues
      }

      navigate('/dashboard', { replace: true })
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, 'Unable to log in'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const footerSlot = (
    <>
      <div className={styles.divider}>
        <span className={styles.dividerLine} />
        <span>Or</span>
        <span className={styles.dividerLine} />
      </div>
      <div className={styles.socialRow}>
        <button type="button" className={styles.socialButton} onClick={handleProviderRedirect}>
          <span className={styles.socialIcon}>TODO</span>
          Sign in with Google
        </button>
        <button type="button" className={styles.socialButton} onClick={handleProviderRedirect}>
          <span className={styles.socialIcon}>TODO</span>
          Sign in with Apple
        </button>
      </div>
      <p className={styles.metaRow}>
        Don't have an account?{' '}
        <Link to="/register" className={styles.link}>
          Sign Up
        </Link>
      </p>
    </>
  )

  return (
    <AuthLayout
      title="Welcome back!"
      subtitle="Enter your Credentials to access your account"
      footerSlot={footerSlot}
      imageSrc={AUTH_IMAGE_SRC}
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="login-email">
            Email address
          </label>
          <input
            id="login-email"
            className={styles.input}
            type="email"
            name="email"
            placeholder="Enter your email"
            value={formState.email}
            onChange={handleChange}
            autoComplete="email"
          />
        </div>
        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label className={styles.label} htmlFor="login-password">
              Password
            </label>
            <button type="button" className={styles.link} onClick={handleForgotPassword}>
              forgot password
            </button>
          </div>
          <input
            id="login-password"
            className={styles.input}
            type="password"
            name="password"
            placeholder="Enter your password"
            value={formState.password}
            onChange={handleChange}
            autoComplete="current-password"
          />
        </div>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            name="remember"
            checked={formState.remember}
            onChange={handleChange}
          />
          Remember for 30 days
        </label>
        <button type="submit" className={styles.primaryButton} disabled={isSubmitting}>
          {isSubmitting ? 'Processing...' : 'Login'}
        </button>
        {errorMessage ? <p className={styles.errorMessage}>{errorMessage}</p> : null}
        {statusMessage ? <p className={styles.successMessage}>{statusMessage}</p> : null}
      </form>
    </AuthLayout>
  )
}

export default Login

