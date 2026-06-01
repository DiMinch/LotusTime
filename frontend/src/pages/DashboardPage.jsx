import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import {
  Users, ChalkboardTeacher, Door, Clock,
  CalendarDots, Lightning, ArrowRight, CalendarCheck, Sparkle
} from '@phosphor-icons/react'

const STAT_CARDS = [
  { key: 'persons', label: 'Giáo viên & TA', icon: Users, color: 'var(--color-primary)', href: '/persons' },
  { key: 'classes', label: 'Lớp học', icon: ChalkboardTeacher, color: 'var(--color-accent)', href: '/classes' },
  { key: 'rooms', label: 'Phòng học', icon: Door, color: 'var(--color-ink)', href: '/rooms' },
  { key: 'timeSlots', label: 'Khung giờ', icon: Clock, color: '#f59e0b', href: '/time-slots' },
]

export default function DashboardPage() {
  const [stats, setStats] = useState({ persons: 0, classes: 0, rooms: 0, timeSlots: 0 })
  const [weeks, setWeeks] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      api.getPersons().catch(() => []),
      api.getClasses().catch(() => []),
      api.getRooms().catch(() => []),
      api.getTimeSlots().catch(() => []),
      api.getWeeks().catch(() => []),
    ]).then(([p, c, r, t, w]) => {
      setStats({ persons: p.length, classes: c.length, rooms: r.length, timeSlots: t.length })
      setWeeks(w)
    })
  }, [])

  const latestWeek = weeks[0]
  const STATUS_LABELS = {
    draft: 'Bản nháp', solving: 'Đang xếp', review: 'Chờ duyệt', published: 'Đã xuất bản'
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tổng Quan</h1>
          <p className="page-subtitle">Bảng điều khiển hệ thống LotusTime</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-xl)', marginBottom: 'var(--space-xxl)' }}>
        {STAT_CARDS.map(sc => (
          <div key={sc.key} className="card" style={{ position: 'relative', cursor: 'pointer' }} onClick={() => navigate(sc.href)}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: 12, height: 12, background: sc.color }} />
            <sc.icon size={28} weight="light" color={sc.color} />
            <p style={{ fontSize: 'var(--text-display-lg-size)', fontWeight: 700, color: sc.color, margin: 'var(--space-sm) 0 var(--space-xs)' }}>
              {stats[sc.key]}
            </p>
            <p style={{ fontSize: 'var(--text-body-sm-size)', color: 'var(--color-mute)' }}>{sc.label}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-xl)', marginBottom: 'var(--space-xxl)' }}>
        {/* Latest Week Status */}
        <div className="card" style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: 12, height: 12, background: 'var(--color-accent)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
            <CalendarCheck size={24} weight="light" color="var(--color-accent)" />
            <h2 style={{ fontSize: 'var(--text-heading-sm-size)', fontWeight: 700 }}>Tuần Mới Nhất</h2>
          </div>
          {latestWeek ? (
            <div>
              <p style={{ fontSize: 'var(--text-body-md-size)', marginBottom: 'var(--space-sm)' }}>
                <strong>Tuần {new Date(latestWeek.week_start).toLocaleDateString('vi-VN')}</strong>
              </p>
              <p style={{ fontSize: 'var(--text-body-sm-size)', color: 'var(--color-mute)', marginBottom: 'var(--space-lg)' }}>
                Trạng thái: <span className={`chip ${latestWeek.status === 'published' ? 'chip-green' : latestWeek.status === 'review' ? 'chip-pink' : 'chip-gray'}`}>
                  {STATUS_LABELS[latestWeek.status] || latestWeek.status}
                </span>
              </p>
              <button className="btn-outline btn-sm" onClick={() => navigate(`/weeks/${latestWeek.id}`)}>
                Xem chi tiết <ArrowRight size={14} weight="bold" style={{ marginLeft: 4 }} />
              </button>
            </div>
          ) : (
            <p style={{ color: 'var(--color-mute)', fontSize: 'var(--text-body-sm-size)' }}>Chưa có tuần nào.</p>
          )}
        </div>

        {/* System Health */}
        <div className="card" style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: 12, height: 12, background: 'var(--color-primary)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
            <Sparkle size={24} weight="light" color="var(--color-primary)" />
            <h2 style={{ fontSize: 'var(--text-heading-sm-size)', fontWeight: 700 }}>Hệ Thống</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <StatusRow label="Frontend (Vite)" status="running" port="5173" />
            <StatusRow label="Backend (Express)" status="running" port="5000" />
            <StatusRow label="Solver (Flask)" status="running" port="8000" />
            <StatusRow label="PostgreSQL (Docker)" status="running" port="5433" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card" style={{ position: 'relative', padding: 'var(--space-xxl)' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: 12, height: 12, background: 'var(--color-primary)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
          <Lightning size={24} weight="light" color="var(--color-primary)" />
          <h2 style={{ fontSize: 'var(--text-heading-md-size)', fontWeight: 700 }}>Bắt Đầu Nhanh</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-xl)' }}>
          <QuickAction icon={Users} title="Thêm Giáo viên" desc="Đăng ký GV/TA mới và gán năng lực" href="/persons" />
          <QuickAction icon={ChalkboardTeacher} title="Tạo Lớp học" desc="Thiết lập lớp mới với yêu cầu cụ thể" href="/classes" />
          <QuickAction icon={CalendarDots} title="Xếp lịch tuần" desc="Tạo tuần mới và chạy Solver tự động" href="/weeks" />
        </div>
      </div>
    </div>
  )
}

function StatusRow({ label, status, port }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--color-hairline)' }}>
      <span style={{ fontSize: 'var(--text-body-sm-size)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 'var(--text-caption-sm-size)', color: 'var(--color-mute)' }}>:{port}</span>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: status === 'running' ? 'var(--color-primary)' : '#ef4444' }} />
      </div>
    </div>
  )
}

function QuickAction({ icon: Icon, title, desc, href }) {
  return (
    <a href={href} style={{ display: 'block', padding: 'var(--space-lg)', border: '1px solid var(--color-hairline)', borderRadius: 'var(--radius-sm)', textDecoration: 'none', color: 'inherit', transition: 'border-color 0.15s ease' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-primary)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-hairline)'}
    >
      <Icon size={24} weight="light" color="var(--color-primary)" style={{ marginBottom: 'var(--space-sm)' }} />
      <p style={{ fontWeight: 700, fontSize: 'var(--text-card-title-size)', marginBottom: 'var(--space-xs)' }}>{title}</p>
      <p style={{ fontSize: 'var(--text-caption-sm-size)', color: 'var(--color-mute)', marginBottom: 'var(--space-md)' }}>{desc}</p>
      <span style={{ fontSize: 'var(--text-button-sm-size)', fontWeight: 700, color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        Mở <ArrowRight size={14} weight="bold" />
      </span>
    </a>
  )
}
