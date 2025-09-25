import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './User.scss'
import avatarImage from '../../../assets/images/avatars/7.jpg'
import { extractErrorMessage } from '../../../services/authService'
import { getUserProfile, updateUserProfile, uploadUserAvatar } from '../../../services/userService'

const AUTH_TOKEN_KEY = 'minerranger.authToken'
const AUTH_USER_KEY = 'minerranger.user'
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024

const initialFormState = {
  firstName: '',
  lastName: '',
  username: '',
  telNumber: '',
  gender: '',
}

const initialPasswordState = {
  currentPassword: '',
  confirmPassword: '',
  newPassword: '',
  confirmNewPassword: '',
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

const persistUserToStorage = (profile) => {
  try {
    const storedUser = {
      id: profile.id,
      email: profile.email,
      username: profile.username,
      avatar: profile.avatar ?? '',
    }
    window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(storedUser))
  } catch (storageError) {
    // ignore storage access issues
  }
}

const UserPage = () => {
  const navigate = useNavigate()
  const [authToken, setAuthToken] = useState('')
  const [formState, setFormState] = useState(initialFormState)
  const [passwordState, setPasswordState] = useState(initialPasswordState)
  const [profileData, setProfileData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isPasswordSaving, setIsPasswordSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordStatus, setPasswordStatus] = useState('')
  const [isAvatarUploading, setIsAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const [avatarStatus, setAvatarStatus] = useState('')
  const avatarInputRef = useRef(null)

  const updateProfileState = useCallback((data) => {
    if (!data) {
      setProfileData(null)
      setFormState({ ...initialFormState })
      return
    }

    const profile = {
      ...data,
      avatar: normalizeValue(data.avatar),
    }

    setProfileData(profile)
    setFormState({
      firstName: profile.firstName ?? '',
      lastName: profile.lastName ?? '',
      username: profile.username ?? '',
      telNumber: profile.telNumber ?? '',
      gender: profile.gender ?? '',
    })
  }, [])

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
    setPasswordError('')
    setPasswordStatus('')
    setAvatarError('')
    setAvatarStatus('')
    setPasswordState({ ...initialPasswordState })

    try {
      const data = await getUserProfile(token)
      updateProfileState(data)
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
  }, [handleUnauthorized, updateProfileState])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const handleAvatarClick = () => {
    if (isAvatarUploading || isLoading) {
      return
    }

    setAvatarError('')
    setAvatarStatus('')
    avatarInputRef.current?.click()
  }

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0]
    setAvatarError('')
    setAvatarStatus('')

    if (!file) {
      return
    }

    if (file.type !== 'image/png') {
      setAvatarError('Please choose a PNG image.')
      event.target.value = ''
      return
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      setAvatarError('Avatar must be 5 MB or smaller.')
      event.target.value = ''
      return
    }

    if (!authToken) {
      setAvatarError('Authentication required. Please log in again.')
      event.target.value = ''
      handleUnauthorized()
      return
    }

    setIsAvatarUploading(true)
    try {
      const updatedProfile = await uploadUserAvatar(authToken, file)
      updateProfileState(updatedProfile)
      persistUserToStorage(updatedProfile)
      setAvatarStatus('Avatar updated successfully.')
    } catch (error) {
      const message = extractErrorMessage(error, 'Unable to upload avatar right now.')
      setAvatarError(message)
      if (error?.response?.status === 401) {
        handleUnauthorized()
      }
    } finally {
      setIsAvatarUploading(false)
      event.target.value = ''
    }
  }

  const handleInputChange = (event) => {
    const { name, value } = event.target
    setFormState((prev) => ({ ...prev, [name]: value }))
  }

  const handlePasswordInputChange = (event) => {
    const { name, value } = event.target
    setPasswordState((prev) => ({ ...prev, [name]: value }))
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
      const { passwordChanged: _passwordChanged, ...profileFields } = updated
      updateProfileState(profileFields)
      setStatusMessage('Profile updated successfully.')
      persistUserToStorage(profileFields)
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

  const handleSavePassword = async () => {
    setPasswordError('')
    setPasswordStatus('')

    if (!authToken) {
      setPasswordError('Authentication required. Please log in again.')
      handleUnauthorized()
      return
    }

    if (!profileData) {
      setPasswordError('Profile data not loaded yet.')
      return
    }

    const { currentPassword, confirmPassword, newPassword, confirmNewPassword } = passwordState

    if (!currentPassword || !confirmPassword || !newPassword || !confirmNewPassword) {
      setPasswordError('Please complete all password fields.')
      return
    }

    if (currentPassword !== confirmPassword) {
      setPasswordError('Current password confirmation does not match.')
      return
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError('New password confirmation does not match.')
      return
    }

    if (newPassword === currentPassword) {
      setPasswordError('New password must be different from current password.')
      return
    }

    setIsPasswordSaving(true)
    try {
      const updated = await updateUserProfile(authToken, {
        currentPassword,
        confirmPassword,
        newPassword,
        confirmNewPassword,
      })
      const { passwordChanged, ...profileFields } = updated
      updateProfileState(profileFields)
      persistUserToStorage(profileFields)
      setPasswordState({ ...initialPasswordState })
      setPasswordStatus(passwordChanged ? 'Password updated successfully.' : 'No password changes applied.')
    } catch (error) {
      const message = extractErrorMessage(error, 'Unable to update password right now.')
      setPasswordError(message)
      if (error?.response?.status === 401) {
        handleUnauthorized()
      }
    } finally {
      setIsPasswordSaving(false)
    }
  }

  const genderDisplay = formatGender(profileData?.gender)

  const profileAvatar = normalizeValue(profileData?.avatar)

  const displayProfile = {
    avatar: profileAvatar || avatarImage,
    username: profileData?.username ? `@${profileData.username}` : '@User-Name',
    email: profileData?.email || 'user@email.com',
    name:
      [profileData?.firstName, profileData?.lastName]
        .filter((part) => normalizeValue(part))
        .join(' ') || 'Name, Last Name',
    phone: profileData?.telNumber || 'Phone not provided',
    gender: genderDisplay || 'Not specified',
  }

  const accountCreatedAt = profileData?.createdAt ? new Date(profileData.createdAt) : null
  const daysSinceAccountCreation =
    accountCreatedAt && !Number.isNaN(accountCreatedAt.getTime())
      ? Math.max(0, Math.floor((Date.now() - accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24)))
      : null
  const dayStartedValue = daysSinceAccountCreation !== null ? String(daysSinceAccountCreation) : '--'

  const isFormDisabled = isLoading || isSaving
  const isPasswordDisabled = isLoading || isPasswordSaving

  return (
    <div className="user-page">
      <h1 className="user-page__title">Dashboard</h1>
      <div className="user-page__layout">
        <div>
          <article className="user-card">
            <button
              type="button"
              className="user-card__avatar-trigger"
              onClick={handleAvatarClick}
              disabled={isAvatarUploading || isLoading}
            >
              <img src={displayProfile.avatar} alt="User avatar" className="user-card__avatar" />
              <span
                className={`user-card__avatar-overlay${
                  isAvatarUploading ? ' user-card__avatar-overlay--active' : ''
                }`}
              >
                {isAvatarUploading ? 'Uploading...' : 'Change avatar'}
              </span>
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png"
              className="user-card__avatar-input"
              onChange={handleAvatarChange}
            />
            <div className="user-card__username">{displayProfile.username}</div>
            <div className="user-card__email">{displayProfile.email}</div>
            {avatarError ? (
              <div className="user-card__avatar-message user-card__avatar-message--error">
                {avatarError}
              </div>
            ) : null}
            {avatarStatus ? (
              <div className="user-card__avatar-message user-card__avatar-message--success">
                {avatarStatus}
              </div>
            ) : null}
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
                  name="currentPassword"
                  type="password"
                  className="profile-settings__input"
                  placeholder="Put your current password..."
                  value={passwordState.currentPassword}
                  onChange={handlePasswordInputChange}
                  disabled={isPasswordDisabled}
                />
              </div>
              <div className="profile-settings__field">
                <label className="profile-settings__label" htmlFor="confirm-password-input">
                  Confirm password
                </label>
                <input
                  id="confirm-password-input"
                  name="confirmPassword"
                  type="password"
                  className="profile-settings__input"
                  placeholder="Confirm current password..."
                  value={passwordState.confirmPassword}
                  onChange={handlePasswordInputChange}
                  disabled={isPasswordDisabled}
                />
              </div>
              <div className="profile-settings__field">
                <label className="profile-settings__label" htmlFor="new-password-input">
                  New password
                </label>
                <input
                  id="new-password-input"
                  name="newPassword"
                  type="password"
                  className="profile-settings__input"
                  placeholder="Put your new password..."
                  value={passwordState.newPassword}
                  onChange={handlePasswordInputChange}
                  disabled={isPasswordDisabled}
                />
              </div>
              <div className="profile-settings__field">
                <label className="profile-settings__label" htmlFor="confirm-new-password-input">
                  Confirm new password
                </label>
                <input
                  id="confirm-new-password-input"
                  name="confirmNewPassword"
                  type="password"
                  className="profile-settings__input"
                  placeholder="Confirm new password..."
                  value={passwordState.confirmNewPassword}
                  onChange={handlePasswordInputChange}
                  disabled={isPasswordDisabled}
                />
              </div>
            </div>
            <div className="profile-settings__actions">
              <button
                type="button"
                className="profile-settings__button"
                onClick={handleSavePassword}
                disabled={isPasswordDisabled}
              >
                {isPasswordSaving ? 'Saving...' : 'Save changes'}
              </button>
              <button type="button" className="profile-settings__password-help" disabled>
                Forgot your password?
              </button>
            </div>
            {passwordError ? <div className="profile-settings__error">{passwordError}</div> : null}
            {passwordStatus ? <div className="profile-settings__status">{passwordStatus}</div> : null}
          </section>
        </article>

        <aside className="user-metric-stack">
          {[
            { label: 'Day started', value: dayStartedValue, tone: 'red' },
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

