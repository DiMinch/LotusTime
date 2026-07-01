import { useState } from 'react'
import Sidebar from './Sidebar'
import './Layout.css'

export default function Layout({ children }) {
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
        <div style={{ width: '40px' }} /> {/* Spacer to center the logo */}
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
        {children}
      </main>
    </div>
  )
}

