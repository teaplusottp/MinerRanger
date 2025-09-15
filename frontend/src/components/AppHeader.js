import React, { useState } from 'react'
import {
  CHeader,
  CContainer,
  CHeaderNav,
  CNavItem,
  CNavLink,
  CDropdown,
  CDropdownToggle,
  CDropdownMenu,
  CDropdownItem,
} from '@coreui/react'

const AppHeader = ({ onOpenChat }) => {
  const [dbList, setDbList] = useState([])
  const [loaded, setLoaded] = useState(false)

  const fetchDatabases = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/databases")
      const data = await res.json()
      setDbList(data.databases || [])
      setLoaded(true)
    } catch (err) {
      console.error("Lỗi fetch databases:", err)
      setDbList([])
    }
  }

  return (
    <CHeader position="sticky" className="mb-4">
      <CContainer fluid>
        <CHeaderNav className="d-none d-md-flex me-auto">
          <CNavItem>
            <CNavLink href="#">Dashboard</CNavLink>
          </CNavItem>

          <CNavItem>
            <CNavLink href="#">Users</CNavLink>
          </CNavItem>

          {/* Database dropdown - fetch khi click */}
          <CDropdown variant="nav-item" onClick={fetchDatabases}>
            <CDropdownToggle color="secondary" caret={false}>
              Database
            </CDropdownToggle>
            <CDropdownMenu>
              {loaded && dbList.length > 0 ? (
                dbList.map((db, idx) => (
                  <CDropdownItem key={idx} href="#">
                    {db}
                  </CDropdownItem>
                ))
              ) : (
                <CDropdownItem disabled>Loading...</CDropdownItem>
              )}
            </CDropdownMenu>
          </CDropdown>

          {/* Chatbot cũng để dropdown */}
                  <CNavItem>
            <CNavLink
              href="#"
              onClick={(e) => {
                e.preventDefault()
                onOpenChat && onOpenChat()
              }}
            >
              Chatbot
            </CNavLink>
          </CNavItem>

        </CHeaderNav>
      </CContainer>
    </CHeader>
  )
}

export default AppHeader
