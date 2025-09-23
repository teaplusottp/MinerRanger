import React from 'react'
import { Link } from 'react-router-dom'
import styles from './Home.module.scss'
import heroIllustration from '../../../../design/Hero-Wrapper__image--center.png'

const Home = () => {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/home" className={styles.brand} aria-label="Procyon">
            <span className={styles.brandMark} aria-hidden="true" />
            <span className={styles.brandText}>Procyon</span>
          </Link>
          <nav className={styles.nav}>
            <Link to="/about" className={styles.navLink}>
              About us
            </Link>
            <Link to="/blog" className={styles.navLink}>
              Blog
            </Link>
            <Link to="/demo" className={styles.navLink}>
              How it works
            </Link>
          </nav>
          <div className={styles.ctaGroup}>
            <Link to="/register" className={styles.signUp}>
              Sign up
            </Link>
            <Link to="/login" className={styles.logIn}>
              Log in
            </Link>
          </div>
        </div>
      </header>

      <main className={styles.hero}> 
        <div className={styles.heroText}>
          <h1>
            Great <span className={styles.accent}>Product</span> is
            <br /> built by great <span className={styles.accent}>teams</span>
          </h1>
          <p>
            We help build and manage a team of world-class developers to bring your vision to life
          </p>
          <Link to="/login" className={styles.primaryCta}>
            Let&apos;s get started!
          </Link>
        </div>
        <div className={styles.heroArt}>
          <img
            src={heroIllustration}
            alt="Illustration of collaborative product teams at work"
            className={styles.heroImage}
            loading="lazy"
          />
        </div>
      </main>
    </div>
  )
}

export default Home


