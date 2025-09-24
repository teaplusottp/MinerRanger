import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from './AuthLayout'
import styles from './AuthLayout.module.scss'
import googleIcon from '../../assets/images/icons-google.png'
import appleIcon from '../../assets/images/icons-apple.png'
import authIllustration from '../../assets/images/team-collaboration-hero.png'
import { extractErrorMessage, registerUser } from '../../services/authService'

const AUTH_IMAGE_SRC = authIllustration
const REGISTER_REDIRECT_DELAY = 800

const Register = () => {
  const navigate = useNavigate()
  const [formState, setFormState] = useState({
    username: '',
    email: '',
    password: '',
    acceptTerms: false,
  })
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (event) => {
    const { name, type, value, checked } = event.target
    setFormState((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleProviderRedirect = () => {
    navigate('/home')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    setStatusMessage('')

    const username = formState.username.trim()
    const email = formState.email.trim()
    const password = formState.password

    if (!username || !email || !password) {
      setErrorMessage('Please fill out all fields')
      return
    }

    if (!formState.acceptTerms) {
      setErrorMessage('Please agree to the terms & policy')
      return
    }

    setIsSubmitting(true)
    try {
      await registerUser({ username, email, password })
      setStatusMessage('Registration successful. Redirecting to login...')
      window.setTimeout(() => navigate('/login', { replace: true }), REGISTER_REDIRECT_DELAY)
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, 'Unable to register'))
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
          <img src={googleIcon} alt="Google" className={styles.socialIcon} />
          Sign up with Google
        </button>
        <button type="button" className={styles.socialButton} onClick={handleProviderRedirect}>
          <img src={appleIcon} alt="Apple" className={styles.socialIcon} />
          Sign up with Apple
        </button>
      </div>
      <p className={styles.metaRow}>
        Have an account?{' '}
        <Link to="/login" className={styles.link}>
          Sign In
        </Link>
      </p>
    </>
  )

  return (
    <AuthLayout title="Get Started Now" footerSlot={footerSlot} imageSrc={AUTH_IMAGE_SRC}>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="register-name">
            Name
          </label>
          <input
            id="register-name"
            className={styles.input}
            type="text"
            name="username"
            placeholder="Enter your name"
            value={formState.username}
            onChange={handleChange}
            autoComplete="name"
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="register-email">
            Email address
          </label>
          <input
            id="register-email"
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
          <label className={styles.label} htmlFor="register-password">
            Password
          </label>
          <input
            id="register-password"
            className={styles.input}
            type="password"
            name="password"
            placeholder="Enter your password"
            value={formState.password}
            onChange={handleChange}
            autoComplete="new-password"
          />
        </div>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            name="acceptTerms"
            checked={formState.acceptTerms}
            onChange={handleChange}
          />
          <span>
            I agree to the{' '}
            <a href="#todo-terms" className={styles.link}>
              terms &amp; policy
            </a>
          </span>
        </label>
        <button type="submit" className={styles.primaryButton} disabled={isSubmitting}>
          {isSubmitting ? 'Processing...' : 'Signup'}
        </button>
        {errorMessage ? <p className={styles.errorMessage}>{errorMessage}</p> : null}
        {statusMessage ? <p className={styles.successMessage}>{statusMessage}</p> : null}
      </form>
    </AuthLayout>
  )
}

export default Register

