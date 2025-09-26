import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import styles from './ForgotPassword.module.scss'
import artIllustration from '../../assets/images/team-collaboration-hero.png'
import {
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
} from '../../services/passwordResetService'
import { extractErrorMessage } from '../../services/authService'

const OTP_LENGTH = 6

const OtpRequest = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const emailFromState = location.state?.email ?? ''

  useEffect(() => {
    if (!emailFromState) {
      navigate('/forgot-password', { replace: true })
    }
  }, [emailFromState, navigate])

  const maskedEmail = useMemo(() => {
    if (!emailFromState) {
      return 'aaa****xxx@gmail.com'
    }
    const [username, domain] = emailFromState.split('@')
    if (!domain || username.length < 3) {
      return emailFromState
    }
    const visible = username.slice(0, 3)
    const maskedLocal = `${visible}${'*'.repeat(Math.max(username.length - 3, 3))}`
    return `${maskedLocal}@${domain}`
  }, [emailFromState])

  const [otpValues, setOtpValues] = useState(Array(OTP_LENGTH).fill(''))
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const inputRefs = useRef([])

  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus()
    }
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    const otp = otpValues.join('').toUpperCase()

    if (otp.length !== OTP_LENGTH) {
      setErrorMessage('Please enter the 6-character OTP code.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage('')
    setStatusMessage('')

    try {
      await verifyPasswordResetOtp({ email: emailFromState, otp })
      navigate('/reset-password', { state: { email: emailFromState, otp } })
    } catch (error) {
      const message = extractErrorMessage(error, 'Unable to verify OTP. Please try again later.')
      setErrorMessage(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (index, event) => {
    const sanitizedValue = event.target.value.replace(/[^0-9a-zA-Z]/g, '').slice(-1).toUpperCase()
    const nextValues = [...otpValues]
    nextValues[index] = sanitizedValue
    setOtpValues(nextValues)

    if (errorMessage) {
      setErrorMessage('')
    }
    if (statusMessage) {
      setStatusMessage('')
    }

    if (sanitizedValue && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus()
    }
  }

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !otpValues[index] && inputRefs.current[index - 1]) {
      inputRefs.current[index - 1].focus()
    }
    if (event.key === 'ArrowLeft' && inputRefs.current[index - 1]) {
      inputRefs.current[index - 1].focus()
    }
    if (event.key === 'ArrowRight' && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus()
    }
  }

  const handlePaste = (event) => {
    const pastedValue = event.clipboardData.getData('text').toUpperCase().replace(/[^0-9A-Z]/g, '')
    if (!pastedValue) {
      return
    }

    const characters = pastedValue.slice(0, OTP_LENGTH).split('')
    const nextValues = Array(OTP_LENGTH).fill('')
    characters.forEach((char, index) => {
      nextValues[index] = char
    })
    setOtpValues(nextValues)
    const focusIndex = Math.min(characters.length, OTP_LENGTH - 1)
    if (inputRefs.current[focusIndex]) {
      inputRefs.current[focusIndex].focus()
    }
    event.preventDefault()
  }

  const handleResend = async () => {
    if (!emailFromState) {
      return
    }

    setIsResending(true)
    setErrorMessage('')
    setStatusMessage('')

    try {
      await requestPasswordResetOtp({ email: emailFromState })
      setOtpValues(Array(OTP_LENGTH).fill(''))
      setStatusMessage('A new OTP has been sent to your email.')
      if (inputRefs.current[0]) {
        inputRefs.current[0].focus()
      }
    } catch (error) {
      const message = extractErrorMessage(error, 'Unable to resend OTP. Please try again later.')
      setErrorMessage(message)
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.formPanel}>
          <header className={styles.header}>
            <h1 className={styles.title}>Forgot your password?</h1>
            <p className={styles.subtitle}>
              We sent a 6-character OTP code to <strong>{maskedEmail}</strong>
            </p>
          </header>
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.otpGrid}>
              {otpValues.map((value, index) => (
                <input
                  key={index}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className={styles.otpInput}
                  value={value}
                  onChange={(event) => handleChange(index, event)}
                  onKeyDown={(event) => handleKeyDown(index, event)}
                  onPaste={handlePaste}
                  ref={(element) => {
                    inputRefs.current[index] = element
                  }}
                  maxLength={1}
                  disabled={isSubmitting}
                />
              ))}
            </div>
            {errorMessage ? (
              <div className={`${styles.feedback} ${styles.feedbackError}`}>{errorMessage}</div>
            ) : null}
            {statusMessage ? (
              <div className={`${styles.feedback} ${styles.feedbackSuccess}`}>{statusMessage}</div>
            ) : null}
            <div className={styles.resendRow}>
              <button
                type="button"
                className={styles.resendButton}
                onClick={handleResend}
                disabled={isResending || isSubmitting}
              >
                {isResending ? 'Sending...' : 'Resend code'}
              </button>
            </div>
            <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
              {isSubmitting ? 'Verifying...' : 'Submit'}
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

export default OtpRequest

