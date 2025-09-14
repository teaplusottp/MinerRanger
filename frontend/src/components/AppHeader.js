import React, { useEffect, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import {
  CContainer,
  CDropdown,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
  CHeader,
  CHeaderNav,
  CHeaderToggler,
  CNavLink,
  CNavItem,
  useColorModes,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilBell,
  cilContrast,
  cilEnvelopeOpen,
  cilList,
  cilMenu,
  cilMoon,
  cilSun,
} from '@coreui/icons'

import { AppBreadcrumb } from './index'
import { AppHeaderDropdown } from './header/index'

const AppHeader = () => {
  const headerRef = useRef()
  const fileInputRef = useRef(null)
  const { colorMode, setColorMode } = useColorModes('coreui-free-react-admin-template-theme')

  const dispatch = useDispatch()
  const sidebarShow = useSelector((state) => state.sidebarShow)

  useEffect(() => {
    document.addEventListener('scroll', () => {
      headerRef.current &&
        headerRef.current.classList.toggle('shadow-sm', document.documentElement.scrollTop > 0)
    })
  }, [])
const handleFileChange = async (e) => {
  const file = e.target.files[0]
  if (!file) return

  if (!file.name.endsWith(".xes")) {
    alert("Vui lòng chọn file .xes")
    return
  }

  const formData = new FormData()
  formData.append("file", file)

  try {
    const res = await fetch("http://127.0.0.1:8000/upload", {
      method: "POST",
      body: formData,
    })
    const data = await res.json()
    console.log("Server response:", data)
    alert(data.message || "Upload xong")
  } catch (err) {
    console.error("Lỗi upload:", err)
    alert("Upload thất bại")
  }
}


  const triggerFileInput = (e) => {
    e.preventDefault()
    fileInputRef.current.click()
  }

  return (
    <CHeader position="sticky" className="mb-4 p-0" ref={headerRef}>
      <CContainer className="border-bottom px-4" fluid>
        <CHeaderToggler
          onClick={() => dispatch({ type: 'set', sidebarShow: !sidebarShow })}
          style={{ marginInlineStart: '-14px' }}
        >
          <CIcon icon={cilMenu} size="lg" />
        </CHeaderToggler>
        <CHeaderNav className="d-none d-md-flex">
          <CNavItem>
            <CNavLink to="/dashboard" as={NavLink}>
              Dashboard
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink href="#">Users</CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink href="#">Settings</CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink href="#" onClick={triggerFileInput}>
              Uploadfile 
            </CNavLink>
          </CNavItem>
        </CHeaderNav>

        {/* input file ẩn */}
        <input
          type="file"
          accept=".xes"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        <CHeaderNav className="ms-auto">
          <CNavItem>
            <CNavLink href="#">
              <CIcon icon={cilBell} size="lg" />
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink href="#">
              <CIcon icon={cilList} size="lg" />
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink href="#">
              <CIcon icon={cilEnvelopeOpen} size="lg" />
            </CNavLink>
          </CNavItem>
        </CHeaderNav>
        <CHeaderNav>
          <li className="nav-item py-1"> <div className="vr h-100 mx-2 text-body text-opacity-75"></div> </li> <CDropdown variant="nav-item" placement="bottom-end"> <CDropdownToggle caret={false}> {colorMode === 'dark' ? ( <CIcon icon={cilMoon} size="lg" /> ) : colorMode === 'auto' ? ( <CIcon icon={cilContrast} size="lg" /> ) : ( <CIcon icon={cilSun} size="lg" /> )} </CDropdownToggle> <CDropdownMenu> <CDropdownItem active={colorMode === 'light'} className="d-flex align-items-center" as="button" type="button" onClick={() => setColorMode('light')} > <CIcon className="me-2" icon={cilSun} size="lg" /> Light </CDropdownItem> <CDropdownItem active={colorMode === 'dark'} className="d-flex align-items-center" as="button" type="button" onClick={() => setColorMode('dark')} > <CIcon className="me-2" icon={cilMoon} size="lg" /> Dark </CDropdownItem> <CDropdownItem active={colorMode === 'auto'} className="d-flex align-items-center" as="button" type="button" onClick={() => setColorMode('auto')} > <CIcon className="me-2" icon={cilContrast} size="lg" /> Auto </CDropdownItem> </CDropdownMenu> </CDropdown> <li className="nav-item py-1"> <div className="vr h-100 mx-2 text-body text-opacity-75"></div> </li>
          <AppHeaderDropdown />
        </CHeaderNav>
      </CContainer>
      <CContainer className="px-4" fluid>
        <AppBreadcrumb />
      </CContainer>
    </CHeader>
  )
}

export default AppHeader
