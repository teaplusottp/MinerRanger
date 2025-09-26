import React, { useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import styles from './ForgotPassword.module.scss'
import artIllustration from '../../assets/images/team-collaboration-hero.png'

const OTP_LENGTH = 6

const OtpRequest = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const emailFromState = location.state?.email ?? ''

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
  const inputRefs = useRef([])

  const handleSubmit = (event) => {
    event.preventDefault()
    navigate('/reset-password', { state: { email: emailFromState } })
  }

  const handleChange = (index, event) => {
    const rawValue = event.target.value.replace(/[^0-9a-zA-Z]/g, '')
    const value = rawValue.slice(-1)
    const nextValues = [...otpValues]
    nextValues[index] = value
    setOtpValues(nextValues)

    if (value && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus()
    }
  }

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !otpValues[index] && inputRefs.current[index - 1]) {
      inputRefs.current[index - 1].focus()
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
                  ref={(element) => {
                    inputRefs.current[index] = element
                  }}
                  maxLength={1}
                />
              ))}
            </div>
            <div className={styles.resendRow}>
              <span>Resend code (60s)</span>
            </div>
            <button type="submit" className={styles.submitButton}>
              Submit
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



