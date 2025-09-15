import React, { useState } from 'react'
import { AppContent, AppFooter } from '../components/index'
import AppHeader from '../components/AppHeader'
import ChatbotSidebar from '../components/chatbotsidebar'

const DefaultLayout = () => {
  const [chatOpen, setChatOpen] = useState(false)

  return (
    <div>
      <div className="wrapper d-flex flex-column min-vh-100">
        <AppHeader onOpenChat={() => setChatOpen(true)} />

        <div className="body flex-grow-1">
          <AppContent />
        </div>
        <AppFooter />
      </div>

      <ChatbotSidebar isOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  )
}

export default DefaultLayout
