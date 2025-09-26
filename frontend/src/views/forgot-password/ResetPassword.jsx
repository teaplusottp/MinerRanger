import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import styles from './ForgotPassword.module.scss'
import artIllustration from '../../assets/images/team-collaboration-hero.png'
import { resetPasswordWithOtp } from '../../services/passwordResetService'
import { extractErrorMessage } from '../../services/authService'

const ResetPassword = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const emailFromState = location.state?.email ?? ''
  const otpFromState = location.state?.otp ?? ''

  const [formState, setFormState] = useState({
    password: '',
    confirmPassword: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!emailFromState || !otpFromState) {
      navigate('/forgot-password', { replace: true })
    }
  }, [emailFromState, navigate, otpFromState])

  const emailHeading = emailFromState
  const subtitleText = emailHeading
    ? `Please enter your new password for ${emailHeading}.`
    : 'Please enter your new password.'

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormState((prev) => ({ ...prev, [name]: value }))
    if (errorMessage) {
      setErrorMessage('')
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const password = formState.password.trim()
    const confirmPassword = formState.confirmPassword.trim()

    if (!password || !confirmPassword) {
      setErrorMessage('Please fill in both password fields.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage('Password confirmation does not match.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage('')

    try {
      await resetPasswordWithOtp({ email: emailFromState, otp: otpFromState, password })
      navigate('/login', { replace: true, state: { passwordReset: true } })
    } catch (error) {
      const message = extractErrorMessage(error, 'Unable to reset password. Please try again later.')
      setErrorMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.formPanel}>
          <header className={styles.header}>
            <h1 className={styles.title}>Forgot your password?</h1>
            <p className={styles.subtitle}>{subtitleText}</p>
          </header>
          <form className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.field} htmlFor="new-password">
              <span className={styles.label}>New password</span>
              <input
                id="new-password"
                className={styles.passwordInput}
                type="password"
                name="password"
                placeholder="Enter your new password"
                value={formState.password}
                onChange={handleChange}
                required
                autoComplete="new-password"
                disabled={isSubmitting}
              />
            </label>
            <label className={styles.field} htmlFor="confirm-password">
              <span className={styles.label}>Confirm new password</span>
              <input
                id="confirm-password"
                className={styles.passwordInput}
                type="password"
                name="confirmPassword"
                placeholder="Confirm your new password"
                value={formState.confirmPassword}
                onChange={handleChange}
                required
                autoComplete="new-password"
                disabled={isSubmitting}
              />
            </label>
            {errorMessage ? (
              <div className={`${styles.feedback} ${styles.feedbackError}`}>{errorMessage}</div>
            ) : null}
            <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          </form>
        </section>
        <aside className={styles.visualPanel} aria-hidden="true">
          <img src={artIllustration} alt="" className={styles.visualImage} loading="lazy" />
        </aside>
      </div>
    </div>
  )
}

export default ResetPassword

