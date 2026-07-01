import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, CalendarDots, CheckCircle, XCircle, Users, ArrowsClockwise, Clock
} from '@phosphor-icons/react';
import { api } from '../../services/api';
import './NotificationBell.css';

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const containerRef = useRef(null);
  const navigate = useNavigate();

  // 1. Fetch unread count
  const fetchUnreadCount = async () => {
    try {
      const data = await api.getUnreadNotificationsCount();
      setUnreadCount(data.count);
    } catch (err) {
      console.error('Error fetching unread notifications count:', err);
    }
  };

  // 2. Fetch notifications (initial or reset)
  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const data = await api.getNotifications(null, null, 10);
      setNotifications(data.notifications || []);
      setNextCursor(data.nextCursor);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  // 3. Fetch more notifications (pagination)
  const fetchMoreNotifications = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await api.getNotifications(nextCursor.created_at, nextCursor.id, 10);
      setNotifications(prev => [...prev, ...(data.notifications || [])]);
      setNextCursor(data.nextCursor);
    } catch (err) {
      console.error('Error fetching more notifications:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Poll for new notifications count every 30 seconds
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Open / Close toggle
  const handleToggle = () => {
    setIsOpen(prev => {
      const nextVal = !prev;
      if (nextVal) {
        fetchNotifications();
        fetchUnreadCount();
      }
      return nextVal;
    });
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  // Click on a notification item
  const handleItemClick = async (item) => {
    try {
      if (!item.is_read) {
        await api.markNotificationAsRead(item.id);
        setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, is_read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      setIsOpen(false);
      if (item.target_url) {
        navigate(item.target_url);
      }
    } catch (err) {
      console.error('Error handling notification click:', err);
    }
  };

  // Infinite Scroll Observer callback
  const observer = useRef();
  const lastElementRef = useCallback((node) => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && nextCursor) {
        fetchMoreNotifications();
      }
    });

    if (node) observer.current.observe(node);
  }, [loading, loadingMore, nextCursor]);

  // Helper to get relative time string
  const getRelativeTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'Vừa xong';
    if (diffMin < 60) return `${diffMin} phút trước`;
    if (diffHour < 24) return `${diffHour} giờ trước`;
    if (diffDay < 7) return `${diffDay} ngày trước`;
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  };

  // Helper to render type icons
  const getIcon = (type) => {
    switch (type) {
      case 'SCH_PUB':
        return <CalendarDots size={18} weight="fill" />;
      case 'SES_UPD':
        return <Clock size={18} weight="fill" />;
      case 'SUB_REQ':
        return <Users size={18} weight="fill" />;
      case 'ATT_APP':
        return <CheckCircle size={18} weight="fill" style={{ color: 'var(--color-primary-dark)' }} />;
      case 'ATT_REJ':
        return <XCircle size={18} weight="fill" style={{ color: 'var(--color-error)' }} />;
      default:
        return <Bell size={18} weight="fill" />;
    }
  };

  return (
    <div className="notification-bell-container" ref={containerRef}>
      <button className="bell-btn" onClick={handleToggle} aria-label="Notifications">
        <Bell size={24} weight={unreadCount > 0 ? "fill" : "light"} />
        {unreadCount > 0 && (
          <span className="bell-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Thông báo</h3>
            {unreadCount > 0 && (
              <button className="mark-all-read-btn" onClick={handleMarkAllRead}>
                Đánh dấu đọc tất cả
              </button>
            )}
          </div>

          <div className="notification-list">
            {loading ? (
              <div className="notification-empty">Đang tải thông báo...</div>
            ) : notifications.length === 0 ? (
              <div className="notification-empty">Không có thông báo nào.</div>
            ) : (
              <>
                {notifications.map((item, index) => {
                  const isLast = index === notifications.length - 1;
                  return (
                    <div 
                      key={item.id} 
                      ref={isLast ? lastElementRef : null}
                      className={`notification-item ${!item.is_read ? 'unread' : ''}`}
                      onClick={() => handleItemClick(item)}
                    >
                      <div className="notification-item-icon">
                        {getIcon(item.type)}
                      </div>
                      <div className="notification-item-content">
                        <div className="notification-item-title">{item.title}</div>
                        <div className="notification-item-text">{item.content}</div>
                        <div className="notification-item-time">{getRelativeTime(item.created_at)}</div>
                      </div>
                    </div>
                  );
                })}
                {loadingMore && (
                  <div className="notification-loading-more">
                    <ArrowsClockwise className="spinner" size={16} /> Đang tải thêm...
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
