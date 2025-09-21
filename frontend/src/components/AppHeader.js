// ...existing code...
import React, { useState, useRef } from 'react'
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
import upload from '../../public/file.png'
//import chatbot from '../assets/images/chatbot.png'
import chatbot from '../../public/chatbot.png'

const AppHeader = ({ onOpenChat }) => {
  const [dbList, setDbList] = useState([])
  const [loaded, setLoaded] = useState(false)
  const { setSelectedDb } = useDb()
  const fileInputRef = useRef(null)
  const [loading, setLoading] = useState(false)

  // state cho popup upload
  const [visible, setVisible] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [textValue, setTextValue] = useState("")

  // state cho sidebar database
  const [showDbSidebar, setShowDbSidebar] = useState(false)

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
    setLoaded(false)
    await fetchDatabases()
    setShowDbSidebar(true)
  }

  // khi đóng sidebar thì reset lại trạng thái
  const handleCloseSidebar = () => {
    setShowDbSidebar(false)
    setLoaded(false)
  }

  return (
    <CHeader position="sticky" className="mb-4">
      <CContainer fluid style={{ position: 'relative' }}>
        <CHeaderNav className="d-none d-md-flex me-auto">
          <CNavItem>
            <CNavLink href="#" onClick={handleDashboardClick}>
              Dashboard
            </CNavLink>
          </CNavItem>

          <CHeaderNav className="ms-auto d-flex align-items-center">
            <div style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)' }}>
              <CNavLink href="#">Users</CNavLink>
            </div>
          </CHeaderNav>

        <CNavItem>
  <CButton
    color="light"
    variant="ghost"
    onClick={() => setVisible(true)}
    style={{ padding: "4px", border: "none", background: "transparent" }}
  >
    <img
      src={upload}
      alt="Upload"
      style={{ width: "28px", height: "28px" }}
      title="Upload File"
    />
  </CButton>
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

        {/* Right side: Chatbot */}
        <CHeaderNav className="ms-auto d-flex align-items-center">
          <div style={{ position: 'absolute', right: '15%', top: '50%', transform: 'translateY(-50%)' }}>
          <CButton
  color="light"
  variant="ghost"
  onClick={(e) => {
    e.preventDefault()
    onOpenChat && onOpenChat()
  }}
  style={{ padding: "4px", border: "none", background: "transparent" }}
>
  <img
    src={chatbot}
    alt="Chatbot"
    style={{ width: "28px", height: "28px" }}
    title="Chatbot"
  />
</CButton>

          </div>
        </CHeaderNav>
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
// ...existing code...
