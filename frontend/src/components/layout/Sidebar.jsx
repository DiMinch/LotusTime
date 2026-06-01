import { NavLink } from 'react-router-dom'
import {
  CalendarDots, Users, Door, Clock, ChalkboardTeacher,
  CalendarPlus, Gauge, GearSix, CaretLeft, CaretRight
} from '@phosphor-icons/react'
import './Sidebar.css'

const NAV_ITEMS = [
  { to: '/', label: 'Tổng quan', icon: Gauge },
  { to: '/schedule', label: 'Thời khóa biểu', icon: CalendarDots },
  { to: '/persons', label: 'Giáo viên & TA', icon: Users },
  { to: '/classes', label: 'Lớp học', icon: ChalkboardTeacher },
  { to: '/rooms', label: 'Phòng học', icon: Door },
  { to: '/time-slots', label: 'Khung giờ', icon: Clock },
  { to: '/weeks', label: 'Quản lý tuần', icon: CalendarPlus },
]

export default function Sidebar({ isCollapsed, onToggle }) {
  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand">
        {!isCollapsed && (
          <div className="sidebar-logo">
            <span className="logo-lotus">Lotus</span>
            <span className="logo-time">Time</span>
          </div>
        )}
        {isCollapsed && (
          <div className="sidebar-logo-collapsed">
            <span className="logo-lotus">L</span>
            <span className="logo-time">T</span>
          </div>
        )}
        {!isCollapsed && <p className="sidebar-tagline">Xếp lịch thông minh</p>}
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            title={isCollapsed ? item.label : undefined}
          >
            <item.icon size={20} weight="light" />
            {!isCollapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <NavLink to="/settings" className="sidebar-link" title={isCollapsed ? 'Cài đặt' : undefined}>
          <GearSix size={20} weight="light" />
          {!isCollapsed && <span>Cài đặt</span>}
        </NavLink>
        
        <button className="sidebar-toggle-btn" onClick={onToggle} title={isCollapsed ? 'Mở rộng' : 'Thu gọn'}>
          {isCollapsed ? <CaretRight size={18} /> : <CaretLeft size={18} />}
          {!isCollapsed && <span style={{ marginLeft: 'var(--space-md)', fontSize: 'var(--text-body-sm-size)' }}>Thu gọn</span>}
        </button>
      </div>
    </aside>
  )
}
