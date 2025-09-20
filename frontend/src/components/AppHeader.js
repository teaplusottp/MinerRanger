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
  CModal,
  CModalHeader,
  CModalBody,
  CModalFooter,
 CSpinner ,
  CFormTextarea 
} from '@coreui/react'
import { useDb } from '/src/context/DbContext.js'

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

  setLoading(true)   // ⬅️ bật spinner

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
    setLoading(false)   // ⬅️ tắt spinner
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

          {/* Upload popup trigger */}
          <CNavItem>
            <CButton
              color="info"
              variant="outline"
              onClick={() => setVisible(true)}
            >
              Upload File
            </CButton>
          </CNavItem>
        </CHeaderNav>
      </CContainer>

      {/* Modal upload */}
      <CModal visible={visible} onClose={() => setVisible(false)}
        backdrop="static"   // ⬅️ không cho click outside đóng modal
  keyboard={false} 
         size="lg"
       
       >

        <CModalHeader closeButton>Upload File & Input Text</CModalHeader>
      <CModalBody>
  {loading ? (
    <div className="d-flex justify-content-center align-items-center" style={{minHeight: "150px"}}>
      <CSpinner color="primary" />
      <span className="ms-2">Đang xử lý file, vui lòng đợi...</span>
    </div>
  ) : (
    <>
      <CButton
        color="secondary"
        variant="outline"
        onClick={() => fileInputRef.current.click()}
      >
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
         <CButton
  color="primary"
  onClick={handleSubmit}
  disabled={!selectedFile || !textValue.trim() || loading}
>
  {loading ? "Processing..." : "Submit"}
</CButton>

        </CModalFooter>
      </CModal>
    </CHeader>
  )
}

export default AppHeader
