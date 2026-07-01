import { useState } from 'react'
import Sidebar from './Sidebar'
import NotificationBell from './NotificationBell'
import { useAuth } from '../../services/AuthContext'
import './Layout.css'

export default function Layout({ children }) {
  const { user } = useAuth()
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true'
  })
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const nextVal = !prev
      localStorage.setItem('sidebar-collapsed', String(nextVal))
      return nextVal
    })
  }

  const closeMobile = () => {
    setIsMobileOpen(false)
  }

  return (
    <div className={`app-layout ${isCollapsed ? 'sidebar-collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
      {/* Mobile Header */}
      <header className="mobile-header">
        <button className="mobile-menu-btn" onClick={() => setIsMobileOpen(prev => !prev)} aria-label="Toggle Menu">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <div className="mobile-logo">
          <span className="logo-lotus">Lotus</span>
          <span className="logo-time">Time</span>
        </div>
        <NotificationBell />
      </header>

      {/* Overlay Backdrop */}
      {isMobileOpen && (
        <div className="mobile-sidebar-overlay" onClick={closeMobile} />
      )}

      <Sidebar 
        isCollapsed={isCollapsed} 
        onToggle={toggleCollapse} 
        onCloseMobile={closeMobile}
      />
      
      <main className="app-main">
        {/* Desktop Topbar */}
        <header className="desktop-topbar">
          <div className="topbar-left">
            {/* Left aligned spacer or page titles could optionally go here */}
          </div>
          <div className="topbar-right">
            <NotificationBell />
            <div className="topbar-user">
              <span className="topbar-username">{user?.username}</span>
              <span className="topbar-role">{user?.role === 'admin' ? 'Quản trị viên' : 'Trợ giảng / Giáo viên'}</span>
            </div>
          </div>
        </header>
        <div className="app-content">
          {children}
        </div>
      </main>
    </div>
  )
}

