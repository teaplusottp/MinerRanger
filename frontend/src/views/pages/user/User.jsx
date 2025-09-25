import React from 'react'
import './User.scss'
import avatarImage from '../../../assets/images/avatars/7.jpg'

const UserPage = () => {
  const profile = {
    avatar: avatarImage,
    username: '@User-Name',
    email: 'user@email.com',
    name: 'Name, Last Name',
    phone: '+51 966 696 123',
    gender: 'Female',
  }

  const personalDetails = {
    firstName: 'Pepito Rodrick',
    lastName: 'Coronel Sifuentes',
    email: 'pepito.c.sifuentes@uni.pe',
    telCountryCode: '+51',
    telNumber: '969 123 456',
    gender: 'female',
  }

  const metrics = [
    { label: 'Day started', value: '1', tone: 'red' },
    { label: 'Dataset uploaded', value: '17', tone: 'green' },
  ]

  return (
    <div className="user-page">
      <h1 className="user-page__title">Dashboard</h1>
      <div className="user-page__layout">
        <div>
          <article className="user-card">
            <img
              src={profile.avatar}
              alt="User avatar"
              className="user-card__avatar"
            />
            <div className="user-card__username">{profile.username}</div>
            <div className="user-card__email">{profile.email}</div>
          </article>

          <article className="user-info">
            <div className="user-info__title">Information</div>
            <div className="user-info__list">
              <div className="user-info__item">
                <span>Name:</span>
                <span>{profile.name}</span>
              </div>
              <div className="user-info__item">
                <span>Email:</span>
                <span>{profile.email}</span>
              </div>
              <div className="user-info__item">
                <span>Tel:</span>
                <span>{profile.phone}</span>
              </div>
              <div className="user-info__item">
                <span>Gender:</span>
                <span>{profile.gender}</span>
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
                  className="profile-settings__input"
                  defaultValue={personalDetails.firstName}
                  placeholder="Enter your first name"
                />
              </div>
              <div className="profile-settings__field">
                <label className="profile-settings__label" htmlFor="lastName-input">
                  Last Name
                </label>
                <input
                  id="lastName-input"
                  className="profile-settings__input"
                  defaultValue={personalDetails.lastName}
                  placeholder="Enter your last name"
                />
              </div>
              <div className="profile-settings__field">
                <label className="profile-settings__label" htmlFor="username-input">
                  Username
                </label>
                <input
                  id="email-input"
                  type="username"
                  className="profile-settings__input"
                  defaultValue={personalDetails.username}
                  placeholder="LionelRonaldo"
                />
              </div>
              <div className="profile-settings__field">
                <label className="profile-settings__label" htmlFor="tel-input">
                  Tel - Number
                </label>
                <div className="profile-settings__combo">
                  <input
                    id="tel-country-input"
                    className="profile-settings__input profile-settings__input--small"
                    defaultValue={personalDetails.telCountryCode}
                    placeholder="Code"
                  />
                  <input
                    id="tel-input"
                    className="profile-settings__input profile-settings__input--full"
                    defaultValue={personalDetails.telNumber}
                    placeholder="Phone number"
                  />
                </div>
              </div>
              <div className="profile-settings__field profile-settings__field--full">
                <label className="profile-settings__label" htmlFor="gender-select">
                  Gender
                </label>
                <select
                  id="gender-select"
                  className="profile-settings__select"
                  defaultValue={personalDetails.gender}
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
              <button type="button" className="profile-settings__button">
                Save changes
              </button>
            </div>
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
                  placeholder="Put your password..."
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
                  placeholder="Confirm password..."
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
                />
              </div>
            </div>
            <div className="profile-settings__actions">
              <button type="button" className="profile-settings__button">
                Save changes
              </button>
              <button type="button" className="profile-settings__password-help">
                Forgot your password?
              </button>
            </div>
          </section>
        </article>

        <aside className="user-metric-stack">
          {metrics.map((metric) => (
            <div key={metric.label} className="user-metric-card">
              <div className="user-metric-card__label">{metric.label}</div>
              <div
                className={`user-metric-card__value user-metric-card__value--${metric.tone}`}
              >
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
