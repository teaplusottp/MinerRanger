import React from 'react'
import PropTypes from 'prop-types'
import styles from './AuthLayout.module.scss'

const AuthLayout = ({
  title,
  subtitle,
  children,
  footerSlot,
  imageSrc,
  imageAlt = 'Illustration of collaborative product teams working together',
}) => {
  const visualContent = imageSrc ? (
    <img src={imageSrc} alt="" className={styles.visualImage} loading="lazy" />
  ) : (
    <span className={styles.visualTodo}>
      TODO: Replace with final art asset to match design
    </span>
  )

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.formPanel}>
          <div className={styles.headline}>
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <div className={styles.formBody}>{children}</div>
          {footerSlot ? <div className={styles.footerSlot}>{footerSlot}</div> : null}
        </section>
        <aside className={styles.visualPanel} aria-hidden="true">
          <div className={styles.visual}>{visualContent}</div>
          <span className={styles.srOnly}>{imageAlt}</span>
        </aside>
      </div>
    </div>
  )
}

AuthLayout.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  children: PropTypes.node.isRequired,
  footerSlot: PropTypes.node,
  imageSrc: PropTypes.string,
  imageAlt: PropTypes.string,
}

export default AuthLayout


