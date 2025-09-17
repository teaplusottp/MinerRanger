import React, { useState, useRef } from 'react'
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
  CButton,
} from '@coreui/react'
import { useDb } from '/src/context/DbContext.js'

const AppHeader = ({ onOpenChat }) => {
  const [dbList, setDbList] = useState([])
  const [loaded, setLoaded] = useState(false)
  const { setSelectedDb } = useDb()
  const fileInputRef = useRef(null)

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

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await fetch("http://127.0.0.1:8000/upload", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (res.ok) {
        alert("✅ Upload thành công: " + data.filename)
      } else {
        alert("❌ Upload lỗi: " + (data.error || "Không rõ"))
      }
    } catch (err) {
      console.error("Lỗi upload:", err)
      alert("❌ Không kết nối được server")
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

          {/* Database dropdown */}
          <CDropdown variant="nav-item" onClick={fetchDatabases}>
            <CDropdownToggle color="secondary" caret={false}>
              Database
            </CDropdownToggle>
            <CDropdownMenu>
              {loaded && dbList.length > 0 ? (
                dbList.map((db, idx) => (
                  <CDropdownItem
                    key={idx}
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      setSelectedDb(db)
                    }}
                  >
                    {db}
                  </CDropdownItem>
                ))
              ) : (
                <CDropdownItem disabled>Loading...</CDropdownItem>
              )}
            </CDropdownMenu>
          </CDropdown>

          {/* Chatbot */}
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

        
          {/* Upload file */}
          <CNavItem>
            <CButton
              color="info"
              variant="outline"
              onClick={() => fileInputRef.current.click()}
            >
              Upload File
            </CButton>
            <input
              type="file"
              accept=".xes"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
          </CNavItem>

      </CContainer>
    </CHeader>
  )
}

export default AppHeader
