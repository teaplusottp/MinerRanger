import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './User.scss'
import avatarImage from '../../../assets/images/avatars/7.jpg'
import { extractErrorMessage } from '../../../services/authService'
import { getUserProfile, updateUserProfile } from '../../../services/userService'

const AUTH_TOKEN_KEY = 'minerranger.authToken'
const AUTH_USER_KEY = 'minerranger.user'

const initialFormState = {
  firstName: '',
  lastName: '',
  username: '',
  telNumber: '',
  gender: '',
}

const normalizeValue = (value) => {
  if (value === undefined || value === null) {
    return ''
  }
  return String(value).trim()
}

const formatGender = (value) => {
  const normalized = normalizeValue(value).toLowerCase()
  switch (normalized) {
    case 'female':
      return 'Female'
    case 'male':
      return 'Male'
    case 'nonbinary':
      return 'Non-binary'
    case 'na':
      return 'Prefer not to say'
    default:
      return normalizeValue(value)
  }
}

const UserPage = () => {
  const navigate = useNavigate()
  const [authToken, setAuthToken] = useState('')
  const [formState, setFormState] = useState(initialFormState)
  const [profileData, setProfileData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')

  const handleUnauthorized = useCallback(() => {
    try {
      window.localStorage.removeItem(AUTH_TOKEN_KEY)
      window.localStorage.removeItem(AUTH_USER_KEY)
    } catch (storageError) {
      // ignore storage access issues
    }
    navigate('/login', { replace: true })
  }, [navigate])

  const loadProfile = useCallback(async () => {
    let token = null
    try {
      token = window.localStorage.getItem(AUTH_TOKEN_KEY)
    } catch (storageError) {
      token = null
    }

    if (!token) {
      setErrorMessage('Authentication required. Please log in again.')
      setIsLoading(false)
      handleUnauthorized()
      return
    }

    setAuthToken(token)
    setIsLoading(true)
    setErrorMessage('')
    setStatusMessage('')

    try {
      const data = await getUserProfile(token)
      setProfileData(data)
      setFormState({
        firstName: data.firstName ?? '',
        lastName: data.lastName ?? '',
        username: data.username ?? '',
        telNumber: data.telNumber ?? '',
        gender: data.gender ?? '',
      })
    } catch (error) {
      const message = extractErrorMessage(error, 'Unable to load profile right now.')
      setProfileData(null)
      setErrorMessage(message)
      if (error?.response?.status === 401) {
        handleUnauthorized()
      }
    } finally {
      setIsLoading(false)
    }
  }, [handleUnauthorized])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const handleInputChange = (event) => {
    const { name, value } = event.target
    setFormState((prev) => ({ ...prev, [name]: value }))
  }

  const handleSaveProfile = async () => {
    setErrorMessage('')
    setStatusMessage('')

    if (!authToken) {
      setErrorMessage('Authentication required. Please log in again.')
      handleUnauthorized()
      return
    }

    if (!profileData) {
      setErrorMessage('Profile data not loaded yet.')
      return
    }

    const sanitizedUsername = normalizeValue(formState.username)
    if (!sanitizedUsername) {
      setErrorMessage('Username cannot be empty')
      return
    }

    const nextValues = {
      firstName: normalizeValue(formState.firstName),
      lastName: normalizeValue(formState.lastName),
      telNumber: normalizeValue(formState.telNumber),
      gender: normalizeValue(formState.gender),
      username: sanitizedUsername,
    }

    const payload = {}
    Object.entries(nextValues).forEach(([key, value]) => {
      const previous = normalizeValue(profileData?.[key])
      if (value !== previous) {
        payload[key] = value
      }
    })

    if (!Object.keys(payload).length) {
      setStatusMessage('No changes to save.')
      return
    }

    setIsSaving(true)
    try {
      const updated = await updateUserProfile(authToken, payload)
      setProfileData(updated)
      setFormState({
        firstName: updated.firstName ?? '',
        lastName: updated.lastName ?? '',
        username: updated.username ?? '',
        telNumber: updated.telNumber ?? '',
        gender: updated.gender ?? '',
      })
      setStatusMessage('Profile updated successfully.')
      try {
        const storedUser = {
          id: updated.id,
          email: updated.email,
          username: updated.username,
        }
        window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(storedUser))
      } catch (storageError) {
        // ignore storage access issues
      }
    } catch (error) {
      const message = extractErrorMessage(error, 'Unable to update profile right now.')
      setErrorMessage(message)
      if (error?.response?.status === 401) {
        handleUnauthorized()
      }
    } finally {
      setIsSaving(false)
    }
  }

  const genderDisplay = formatGender(profileData?.gender)

  const displayProfile = {
    avatar: avatarImage,
    username: profileData?.username ? `@${profileData.username}` : '@User-Name',
    email: profileData?.email || 'user@email.com',
    name:
      [profileData?.firstName, profileData?.lastName]
        .filter((part) => normalizeValue(part))
        .join(' ') || 'Name, Last Name',
    phone: profileData?.telNumber || 'Phone not provided',
    gender: genderDisplay || 'Not specified',
  }

  const isFormDisabled = isLoading || isSaving

  return (
    <div className="user-page">
      <h1 className="user-page__title">Dashboard</h1>
      <div className="user-page__layout">
        <div>
          <article className="user-card">
            <img src={displayProfile.avatar} alt="User avatar" className="user-card__avatar" />
            <div className="user-card__username">{displayProfile.username}</div>
            <div className="user-card__email">{displayProfile.email}</div>
          </article>

          <article className="user-info">
            <div className="user-info__title">Information</div>
            <div className="user-info__list">
              <div className="user-info__item">
                <span>Name:</span>
                <span>{displayProfile.name}</span>
              </div>
              <div className="user-info__item">
                <span>Email:</span>
                <span>{displayProfile.email}</span>
              </div>
              <div className="user-info__item">
                <span>Tel:</span>
                <span>{displayProfile.phone}</span>
              </div>
              <div className="user-info__item">
                <span>Gender:</span>
                <span>{displayProfile.gender}</span>
              </div>
            </div>
          </article>
        </div>

        <article className="profile-settings">
          <div className="profile-settings__header">User Settings</div>

          <section className="profile-settings__section">
            <div className="profile-settings__section-title">Details</div>
            <div className="profile-settings__grid">
              <div className="profile-settings__field">
                <label className="profile-settings__label" htmlFor="firstName-input">
                  First Name
                </label>
                <input
                  id="firstName-input"
                  name="firstName"
                  className="profile-settings__input"
                  value={formState.firstName}
                  onChange={handleInputChange}
                  placeholder="Enter your first name"
                  disabled={isFormDisabled}
                />
              </div>
              <div className="profile-settings__field">
                <label className="profile-settings__label" htmlFor="lastName-input">
                  Last Name
                </label>
                <input
                  id="lastName-input"
                  name="lastName"
                  className="profile-settings__input"
                  value={formState.lastName}
                  onChange={handleInputChange}
                  placeholder="Enter your last name"
                  disabled={isFormDisabled}
                />
              </div>
              <div className="profile-settings__field">
                <label className="profile-settings__label" htmlFor="username-input">
                  Username
                </label>
                <input
                  id="username-input"
                  name="username"
                  className="profile-settings__input"
                  value={formState.username}
                  onChange={handleInputChange}
                  placeholder="LionelRonaldo"
                  disabled={isFormDisabled}
                />
              </div>
              <div className="profile-settings__field">
                <label className="profile-settings__label" htmlFor="tel-input">
                  Tel - Number
                </label>
                <input
                  id="tel-input"
                  name="telNumber"
                  className="profile-settings__input"
                  value={formState.telNumber}
                  onChange={handleInputChange}
                  placeholder="Phone number"
                  disabled={isFormDisabled}
                />
              </div>
              <div className="profile-settings__field profile-settings__field--full">
                <label className="profile-settings__label" htmlFor="gender-select">
                  Gender
                </label>
                <select
                  id="gender-select"
                  name="gender"
                  className="profile-settings__select"
                  value={formState.gender}
                  onChange={handleInputChange}
                  disabled={isFormDisabled}
                >
                  <option value="" disabled>
                    Select gender
                  </option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="nonbinary">Non-binary</option>
                  <option value="na">Prefer not to say</option>
                </select>
              </div>
            </div>
            <div className="profile-settings__actions">
              <button
                type="button"
                className="profile-settings__button"
                onClick={handleSaveProfile}
                disabled={isFormDisabled}
              >
                {isSaving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
            {errorMessage ? <div className="profile-settings__error">{errorMessage}</div> : null}
            {statusMessage ? <div className="profile-settings__status">{statusMessage}</div> : null}
          </section>

          <section className="profile-settings__section">
            <div className="profile-settings__section-title">Password</div>
            <div className="profile-settings__grid">
              <div className="profile-settings__field">
                <label className="profile-settings__label" htmlFor="current-password-input">
                  Change password
                </label>
                <input
                  id="current-password-input"
                  type="password"
                  className="profile-settings__input"
                  placeholder="Put your current password..."
                  disabled
                />
              </div>
              <div className="profile-settings__field">
                <label className="profile-settings__label" htmlFor="confirm-password-input">
                  Confirm password
                </label>
                <input
                  id="confirm-password-input"
                  type="password"
                  className="profile-settings__input"
                  placeholder="Confirm current password..."
                  disabled
                />
              </div>
              <div className="profile-settings__field">
                <label className="profile-settings__label" htmlFor="new-password-input">
                  New password
                </label>
                <input
                  id="new-password-input"
                  type="password"
                  className="profile-settings__input"
                  placeholder="Put your new password..."
                  disabled
                />
              </div>
              <div className="profile-settings__field">
                <label className="profile-settings__label" htmlFor="confirm-new-password-input">
                  Confirm new password
                </label>
                <input
                  id="confirm-new-password-input"
                  type="password"
                  className="profile-settings__input"
                  placeholder="Confirm new password..."
                  disabled
                />
              </div>
            </div>
            <div className="profile-settings__actions">
              <button type="button" className="profile-settings__button" disabled>
                Save changes
              </button>
              <button type="button" className="profile-settings__password-help" disabled>
                Forgot your password?
              </button>
            </div>
          </section>
        </article>

        <aside className="user-metric-stack">
          {[
            { label: 'Day started', value: '1', tone: 'red' },
            { label: 'Dataset uploaded', value: '17', tone: 'green' },
          ].map((metric) => (
            <div key={metric.label} className="user-metric-card">
              <div className="user-metric-card__label">{metric.label}</div>
              <div className={`user-metric-card__value user-metric-card__value--${metric.tone}`}>
                {metric.value}
              </div>
            </div>
          ))}
        </aside>
      </div>
    </div>
  )
}

export default UserPage
