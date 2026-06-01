import { useState } from 'react'
import Sidebar from './Sidebar'
import './Layout.css'

export default function Layout({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true'
  })

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const nextVal = !prev
      localStorage.setItem('sidebar-collapsed', String(nextVal))
      return nextVal
    })
  }

  return (
    <div className={`app-layout ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar isCollapsed={isCollapsed} onToggle={toggleCollapse} />
      <main className="app-main">
        {children}
      </main>
    </div>
  )
}
