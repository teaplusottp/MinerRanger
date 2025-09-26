import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './ForgotPassword.module.scss'
import artIllustration from '../../assets/images/team-collaboration-hero.png'
import { requestPasswordResetOtp } from '../../services/passwordResetService'
import { extractErrorMessage } from '../../services/authService'

const ForgotPassword = () => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    const normalizedEmail = email.trim()

    if (!normalizedEmail) {
      setErrorMessage('Please enter your email address.')
      return
    }

    setErrorMessage('')
    setIsSubmitting(true)

    try {
      await requestPasswordResetOtp({ email: normalizedEmail })
      navigate('/otp-request', { state: { email: normalizedEmail } })
    } catch (error) {
      const message = extractErrorMessage(error, 'Unable to send OTP. Please try again later.')
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
            <p className={styles.subtitle}>
              Please enter the email address associated with your account.
            </p>
          </header>
          <form className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.field} htmlFor="recovery-email">
              <span className={styles.label}>Email address</span>
              <input
                id="recovery-email"
                className={styles.input}
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  if (errorMessage) {
                    setErrorMessage('')
                  }
                }}
                required
                autoComplete="email"
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

export default ForgotPassword

