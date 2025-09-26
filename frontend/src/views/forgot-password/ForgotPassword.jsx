import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './ForgotPassword.module.scss'
import artIllustration from '../../assets/images/team-collaboration-hero.png'

const ForgotPassword = () => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    navigate('/otp-request', { state: { email: email.trim() } })
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
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
              />
            </label>
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

export default ForgotPassword
