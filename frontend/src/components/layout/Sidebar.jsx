import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../services/AuthContext';
import {
  CalendarDots, Users, Door, Clock, ChalkboardTeacher,
  CalendarPlus, Gauge, GearSix, CaretLeft, CaretRight,
  User, UserGear, SignOut, QrCode, Coins
} from '@phosphor-icons/react';
import './Sidebar.css';

export default function Sidebar({ isCollapsed, onToggle, onCloseMobile }) {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Define admin navigation items
  const adminNavItems = [
    { to: '/', label: 'Tổng quan', icon: Gauge },
    { to: '/schedule', label: 'Thời khóa biểu', icon: CalendarDots },
    { to: '/admin/attendance', label: 'Quản lý chấm công', icon: Coins },
    { to: '/attendance', label: 'Chấm công TA', icon: QrCode },
    { to: '/persons', label: 'Giáo viên & TA', icon: Users },
    { to: '/classes', label: 'Lớp học', icon: ChalkboardTeacher },
    { to: '/rooms', label: 'Phòng học', icon: Door },
    { to: '/time-slots', label: 'Khung giờ', icon: Clock },
    { to: '/weeks', label: 'Quản lý tuần', icon: CalendarPlus },
  ];

  // Define staff navigation items
  const staffNavItems = [
    { to: '/attendance', label: 'Chấm công TA', icon: QrCode },
    { to: '/profile', label: 'Hồ sơ cá nhân', icon: User },
  ];

  const navItems = isAdmin ? adminNavItems : staffNavItems;

  return (
    <aside 
      className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}
      onClick={(e) => {
        if (e.target.closest('a') || e.target.closest('button')) {
          if (e.target.closest('.sidebar-toggle-btn')) return;
          if (onCloseMobile) onCloseMobile();
        }
      }}
    >
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
        {navItems.map(item => (
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
        {/* Profile link for admin is placed here for consistency */}
        {isAdmin && (
          <NavLink to="/profile" className="sidebar-link" title={isCollapsed ? 'Hồ sơ cá nhân' : undefined}>
            <User size={20} weight="light" />
            {!isCollapsed && <span>Hồ sơ cá nhân</span>}
          </NavLink>
        )}

        {isAdmin && (
          <NavLink to="/settings" className="sidebar-link" title={isCollapsed ? 'Cài đặt' : undefined}>
            <GearSix size={20} weight="light" />
            {!isCollapsed && <span>Cài đặt</span>}
          </NavLink>
        )}

        <button className="sidebar-link" onClick={handleLogout} title={isCollapsed ? 'Đăng xuất' : undefined} style={{ background: 'none', border: 'none', width: '100%', cursor: 'pointer', textAlign: 'left', color: 'var(--color-accent)' }}>
          <SignOut size={20} weight="light" />
          {!isCollapsed && <span>Đăng xuất</span>}
        </button>
        
        <button className="sidebar-toggle-btn" onClick={onToggle} title={isCollapsed ? 'Mở rộng' : 'Thu gọn'}>
          {isCollapsed ? <CaretRight size={18} /> : <CaretLeft size={18} />}
          {!isCollapsed && <span style={{ marginLeft: 'var(--space-md)', fontSize: 'var(--text-body-sm-size)' }}>Thu gọn</span>}
        </button>
      </div>
    </aside>
  );
}
