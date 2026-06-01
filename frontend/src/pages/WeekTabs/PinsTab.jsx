import { useState, useEffect } from 'react'
import { api } from '../../services/api'
import { PushPin, Trash, Info } from '@phosphor-icons/react'
import { useToast } from '../../components/layout/Toast'
import { useConfirm } from '../../components/layout/ConfirmModal'

export default function PinsTab({ weekId }) {
  const toast = useToast()
  const confirm = useConfirm()
  const [sessions, setSessions] = useState([])
  const [classes, setClasses] = useState([])
  const [rooms, setRooms] = useState([])
  const [timeSlots, setTimeSlots] = useState([])

  const [form, setForm] = useState({ class_id: '', room_id: '', time_slot_id: '', pin_reason: '' })
  const [loading, setLoading] = useState(false)

  const load = () => api.getSessions(weekId).then(res => setSessions(res.filter(s => s.is_pinned))).catch(console.error)
  
  useEffect(() => {
    load()
    Promise.all([api.getClasses(), api.getRooms(), api.getTimeSlots()]).then(([c, r, ts]) => {
      setClasses(c)
      setRooms(r)
      setTimeSlots(ts)
      if (c.length > 0 && r.length > 0 && ts.length > 0) {
        setForm({ class_id: c[0].id, room_id: r[0].id, time_slot_id: ts[0].id, pin_reason: 'Yêu cầu đặc biệt' })
      }
    }).catch(console.error)
  }, [weekId])

  const handlePin = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.pinSession(weekId, form)
      toast.success('Đã gán cứng lịch thành công!')
      load()
    } catch (err) {
      toast.error('Lỗi gán cứng: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (sid) => {
    const ok = await confirm({
      title: 'Bỏ gán cứng',
      message: 'Bạn có chắc muốn bỏ gán cứng buổi học này? Solver sẽ tự do xếp lịch lại.',
      confirmText: 'Bỏ gán',
      variant: 'warning'
    })
    if (ok) {
      await api.deleteSession(weekId, sid)
      toast.success('Đã bỏ gán cứng.')
      load()
    }
  }

  return (
    <div style={{ maxWidth: '900px' }}>
      <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
        <h2 style={{ fontSize: 'var(--text-heading-md-size)', marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <PushPin size={24} color="var(--color-primary)" weight="fill" />
          Gán Cứng Lịch (Manual Pin)
        </h2>
        <p style={{ fontSize: 'var(--text-body-sm-size)', color: 'var(--color-mute)', marginBottom: 'var(--space-lg)' }}>
          Cố định một lớp học vào thời gian và phòng cụ thể trước khi chạy hệ thống tự động. 
          Solver sẽ ưu tiên giữ nguyên các lớp đã gán cứng.
        </p>

        <form onSubmit={handlePin} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: 'var(--space-md)', alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Lớp học</label>
            <select className="select-input" value={form.class_id} onChange={e => setForm(f => ({ ...f, class_id: e.target.value }))}>
              {classes.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Phòng học</label>
            <select className="select-input" value={form.room_id} onChange={e => setForm(f => ({ ...f, room_id: e.target.value }))}>
              {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Khung giờ</label>
            <select className="select-input" value={form.time_slot_id} onChange={e => setForm(f => ({ ...f, time_slot_id: e.target.value }))}>
              {timeSlots.map(t => <option key={t.id} value={t.id}>Thứ {t.day_of_week} ({t.start_time.slice(0,5)} - {t.end_time.slice(0,5)})</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, gridColumn: '1 / 3' }}>
            <label className="form-label">Lý do (Tùy chọn)</label>
            <input className="text-input" value={form.pin_reason} onChange={e => setForm(f => ({ ...f, pin_reason: e.target.value }))} />
          </div>
          <div style={{ justifySelf: 'end' }}>
            <button type="submit" className="btn-primary" disabled={loading || !form.class_id}>
              {loading ? 'Đang lưu...' : 'Gán cứng ngay'}
            </button>
          </div>
        </form>
      </div>

      <div>
        <h3 style={{ fontSize: 'var(--text-heading-sm-size)', marginBottom: 'var(--space-md)' }}>
          Danh sách đã gán cứng ({sessions.length})
        </h3>
        {sessions.length === 0 ? (
          <div className="empty-state">
            <Info size={48} weight="light" />
            <p>Chưa có lớp nào được gán cứng.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Lớp</th>
                <th>Phòng</th>
                <th>Khung giờ</th>
                <th>Lý do</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{s.class_code}</td>
                  <td>{s.room_name}</td>
                  <td>{s.slot_label}</td>
                  <td style={{ color: 'var(--color-mute)' }}>{s.pin_reason}</td>
                  <td>
                    <button className="btn-icon" onClick={() => handleDelete(s.id)}>
                      <Trash size={18} color="var(--color-error)" weight="light" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
