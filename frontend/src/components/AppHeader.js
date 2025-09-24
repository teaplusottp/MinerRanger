import React, { useEffect, useRef, useState } from 'react'
import {
  CHeader,
  CContainer,
  CHeaderNav,
  CNavItem,
  CNavLink,
  CButton,
  CModal,
  CModalHeader,
  CModalBody,
  CModalFooter,
  CSpinner,
  CFormTextarea,
  COffcanvas,
  COffcanvasHeader,
  COffcanvasBody,
  COffcanvasTitle,
  CListGroup,
  CListGroupItem,
} from '@coreui/react'
import { useDb } from '/src/context/DbContext.js'
import { useNavigate } from 'react-router-dom'
import avatarUser from '../assets/images/avatars/1.jpg'

const AppHeader = ({ onOpenChat }) => {
  const navigate = useNavigate()
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [dbList, setDbList] = useState([])
  const [loaded, setLoaded] = useState(false)
  const { setSelectedDb } = useDb()
  const fileInputRef = useRef(null)
  const userMenuRef = useRef(null)
  const [loading, setLoading] = useState(false)

  // state cho popup upload
  const [visible, setVisible] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [textValue, setTextValue] = useState("")

  // state cho sidebar database
  const [showDbSidebar, setShowDbSidebar] = useState(false)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!isUserMenuOpen) {
        return
      }
      const target = event.target
      const wrapper = userMenuRef.current
      if (wrapper && !wrapper.contains(target)) {
        setIsUserMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isUserMenuOpen])

  const fetchDatabases = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/databases")
      const data = await res.json()
      setDbList(data.databases || [])
      setLoaded(true)
    } catch (err) {
      console.error("Lỗi fetch databases:", err)
      setDbList([])
      setLoaded(true)
    }
  }

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0])
  }

  const handleSubmit = async () => {
    if (!selectedFile) {
      alert("⚠️ Vui lòng chọn file!")
      return
    }

    const formData = new FormData()
    formData.append("file", selectedFile)
    if (textValue.trim()) {
      formData.append("note", textValue)
    }

    setLoading(true)

    try {
      const res = await fetch("http://127.0.0.1:8000/upload", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (res.ok) {
        alert("✅ Upload thành công: " + data.filename)
        setVisible(false)
        setSelectedFile(null)
        setTextValue("")
      } else {
        alert("❌ Upload lỗi: " + (data.error || "Không rõ"))
      }
    } catch (err) {
      console.error("Lỗi upload:", err)
      alert("❌ Không kết nối được server")
    } finally {
      setLoading(false)
    }
  }

  // khi bấm Dashboard: fetch database và mở sidebar
  const handleDashboardClick = async (e) => {
    e.preventDefault()
    setIsUserMenuOpen(false)
    setLoaded(false)
    await fetchDatabases()
    setShowDbSidebar(true)
  }

  // khi đóng sidebar thì reset lại trạng thái
  const handleCloseSidebar = () => {

    setIsUserMenuOpen(false)
    setShowDbSidebar(false)
    setLoaded(false)
  }

  return (

    <CHeader position="sticky" className="mb-4">
      <CContainer fluid className="d-flex align-items-center justify-content-between">
        <CHeaderNav className="d-none d-md-flex align-items-center gap-4">
          <CNavItem>
            <CButton
              type="button"
              className="pill-button"
              onClick={handleDashboardClick}
            >
              Databases
            </CButton>
          </CNavItem>

          <CNavItem className="d-flex align-items-center">
            <button
              type="button"
              className="upload-button"
              onClick={() => setVisible(true)}
              title="Upload File"
            >
              <span className="upload-button__icon" aria-hidden="true">+</span>
              <span className="upload-button__label">Upload</span>
            </button>
          </CNavItem>
        </CHeaderNav>

        {/* Right side: Chatbot */}
        <CHeaderNav className="d-flex align-items-center gap-3">
          <CNavItem>
            <CButton
              type="button"
              className="pill-button"
              onClick={(e) => {
                e.preventDefault()
                setIsUserMenuOpen(false)
                onOpenChat && onOpenChat()
              }}
            >
              Ask Procyon
            </CButton>
          </CNavItem>
          <CNavItem>
            <div className="users-avatar__wrapper" ref={userMenuRef}>
              <CNavLink
                href="#"
                className="py-0 users-avatar"
                aria-label="Team users"
                onClick={(event) => {
                  event.preventDefault()
                  setIsUserMenuOpen((prev) => !prev)
                }}
              >
                <img src={avatarUser} alt="Team users" className="users-avatar__image" />
              </CNavLink>
              {isUserMenuOpen ? (
                <div className="users-menu" role="menu" aria-label="User menu">
                  <button
                    type="button"
                    className="users-menu__item"
                    role="menuitem"
                    onClick={() => {
                      setIsUserMenuOpen(false)
                      navigate('/user')
                    }}
                  >
                    Profile
                  </button>
                  <button
                    type="button"
                    className="users-menu__item"
                    role="menuitem"
                    onClick={() => {
                      setIsUserMenuOpen(false)
                      navigate('/settings')
                    }}
                  >
                    Account settings
                  </button>
                  <button
                    type="button"
                    className="users-menu__item"
                    role="menuitem"
                    onClick={() => {
                      setIsUserMenuOpen(false)
                      navigate('/home')
                    }}
                  >
                    Log out
                  </button>
                </div>
              ) : null}
            </div>
          </CNavItem>
        </CHeaderNav>

        {/* Modal upload */}
        <CModal visible={visible} onClose={() => setVisible(false)} backdrop="static" keyboard={false} size="lg">
          <CModalHeader closeButton>Upload File & Input Text</CModalHeader>
          <CModalBody>
            {loading ? (
              <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "150px" }}>
                <CSpinner color="primary" />
                <span className="ms-2">Đang xử lý file, vui lòng đợi...</span>
              </div>
            ) : (
              <>
                <CButton color="secondary" variant="outline" onClick={() => fileInputRef.current.click()}>
                  Choose File
                </CButton>
                <input
                  type="file"
                  accept=".xes, .xes.gz"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
                {selectedFile && <p className="mt-2">📄 {selectedFile.name}</p>}

                <CFormTextarea
                  rows={6}
                  placeholder="Nhập ghi chú..."
                  className="mt-3"
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                />
              </>
            )}
          </CModalBody>

          <CModalFooter>
            <CButton color="primary" onClick={handleSubmit} disabled={!selectedFile || !textValue.trim() || loading}>
              {loading ? "Processing..." : "Submit"}
            </CButton>
          </CModalFooter>
        </CModal>

      </CContainer>

      {/* Sidebar (offcanvas) hiển thị danh sách databases */}
      <COffcanvas
        placement="start"
        visible={showDbSidebar}
        onClose={handleCloseSidebar}
        onHide={handleCloseSidebar}   // 👈 thêm dòng này
      >
        <COffcanvasHeader>
          <COffcanvasTitle>Databases</COffcanvasTitle>
        </COffcanvasHeader>
        <COffcanvasBody>
          {loaded ? (
            dbList.length > 0 ? (
              <CListGroup>
                {dbList.map((db, idx) => (
                  <CListGroupItem
                    key={idx}
                    component="button"
                    action
                    onClick={() => {
                      setSelectedDb(db)
                      handleCloseSidebar()
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {db}
                  </CListGroupItem>
                ))}
              </CListGroup>
            ) : (
              <div>Không có database</div>
            )
          ) : (
            <div className="d-flex align-items-center">
              <CSpinner size="sm" className="me-2" />
              <span>Đang tải databases...</span>
            </div>
          )}
        </COffcanvasBody>
      </COffcanvas>
    </CHeader>
  )
}

export default AppHeader

















