import React from 'react'
import { CFooter } from '@coreui/react'
import { useLocation } from 'react-router-dom'

const AppFooter = () => {
  const { pathname } = useLocation()
  const isDashboard = pathname === '/dashboard'

  return (
    <CFooter className="px-4">
      {!isDashboard && (
        <>
          <div>
            <a href="https://coreui.io" target="_blank" rel="noopener noreferrer">
              CoreUI
            </a>
            <span className="ms-1">&copy; 2025 creativeLabs.</span>
          </div>
          <div className="ms-auto">
            <span className="me-1">Powered by</span>
            <a href="https://coreui.io/react" target="_blank" rel="noopener noreferrer">
              CoreUI React Admin &amp; Dashboard Template
            </a>
          </div>
        </>
      )}
    </CFooter>
  )
}

export default React.memo(AppFooter)

