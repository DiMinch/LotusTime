import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { Plus, CalendarPlus } from '@phosphor-icons/react'

const STATUS_MAP = {
  draft: { label: 'Bản nháp', cls: 'chip-gray' },
  solving: { label: 'Đang xếp', cls: 'chip-pink' },
  review: { label: 'Chờ duyệt', cls: 'chip-pink' },
  published: { label: 'Đã xuất bản', cls: 'chip-green' },
}

import { useToast } from '../components/layout/Toast'

export default function WeeksPage() {
  const toast = useToast()
  const [weeks, setWeeks] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [weekStart, setWeekStart] = useState('')
  const navigate = useNavigate()

  const load = () => api.getWeeks().then(setWeeks).catch(console.error)
  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!weekStart) return
    try {
      await api.createWeek({ week_start: weekStart })
      toast.success('Đã tạo tuần mới')
      setShowModal(false); setWeekStart(''); load()
    } catch (err) {
      toast.error('Lỗi khi tạo tuần: ' + err.message)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Quản Lý Tuần</h1><p className="page-subtitle">Tạo và theo dõi lịch xếp TKB theo tuần</p></div>
        <button className="btn-primary" onClick={() => setShowModal(true)}><Plus size={18} weight="bold" style={{ marginRight: 8 }} />Tạo tuần mới</button>
      </div>

      {weeks.length === 0 ? (
        <div className="empty-state"><CalendarPlus size={64} weight="light" /><p>Chưa có tuần nào. Tạo tuần đầu tiên.</p></div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead><tr><th>Tuần bắt đầu</th><th>Trạng thái</th><th>Ngày tạo</th><th>Ngày xuất bản</th></tr></thead>
            <tbody>
              {weeks.map(w => (
                <tr key={w.id} onClick={() => navigate(`/weeks/${w.id}`)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 700 }}>{new Date(w.week_start).toLocaleDateString('vi-VN')}</td>
                  <td><span className={`chip ${STATUS_MAP[w.status]?.cls || 'chip-gray'}`}>{STATUS_MAP[w.status]?.label || w.status}</span></td>
                  <td style={{ color: 'var(--color-mute)' }}>{new Date(w.created_at).toLocaleDateString('vi-VN')}</td>
                  <td style={{ color: 'var(--color-mute)' }}>{w.published_at ? new Date(w.published_at).toLocaleDateString('vi-VN') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Tạo Tuần Mới</h2>
            <div className="form-group">
              <label className="form-label">Ngày bắt đầu tuần (Thứ 2)</label>
              <input className="text-input" type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} />
            </div>
            <div className="modal-actions">
              <button className="btn-outline btn-sm" onClick={() => setShowModal(false)}>Hủy</button>
              <button className="btn-primary btn-sm" onClick={handleCreate}>Tạo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
