import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import styles from './ForgotPassword.module.scss'
import artIllustration from '../../assets/images/team-collaboration-hero.png'

const ResetPassword = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [formState, setFormState] = useState({
    password: '',
    confirmPassword: '',
  })

  const emailHeading = location.state?.email
  const subtitleText = emailHeading
    ? `Please enter your new password for ${emailHeading}.`
    : 'Please enter your new password.'

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormState((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    navigate('/login')
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

export default ResetPassword
