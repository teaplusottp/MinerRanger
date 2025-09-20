import React from 'react'
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'
import styles from './PlaceholderPage.module.scss'

const PlaceholderPage = ({ title }) => {
  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <h1>{title}</h1>
        <p>TODO: Replace this placeholder with production-ready content for the {title} experience.</p>
        <Link to="/home" className={styles.backLink}>
          Back to home
        </Link>
      </div>
    </div>
  )
}

PlaceholderPage.propTypes = {
  title: PropTypes.string.isRequired,
}

export default PlaceholderPage
