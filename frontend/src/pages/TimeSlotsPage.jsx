import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { Plus, PencilSimple, Trash, Clock } from '@phosphor-icons/react'
import { useConfirm } from '../components/layout/ConfirmModal'
import { useToast } from '../components/layout/Toast'

const DAYS = [
  { value: 2, label: 'Thứ 2' }, { value: 3, label: 'Thứ 3' },
  { value: 4, label: 'Thứ 4' }, { value: 5, label: 'Thứ 5' },
  { value: 6, label: 'Thứ 6' }, { value: 7, label: 'Thứ 7' },
  { value: 8, label: 'Chủ nhật' },
]

export default function TimeSlotsPage() {
  const confirm = useConfirm()
  const toast = useToast()
  const [slots, setSlots] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ label: '', start_time: '08:00', end_time: '09:30', day_of_week: 2 })

  const load = () => api.getTimeSlots().then(setSlots).catch(console.error)
  useEffect(() => { load() }, [])

  const openCreate = () => { setEditing(null); setForm({ label: '', start_time: '08:00', end_time: '09:30', day_of_week: 2 }); setShowModal(true) }
  const openEdit = (s) => {
    setEditing(s)
    setForm({ label: s.label, start_time: s.start_time?.slice(0, 5) || '08:00', end_time: s.end_time?.slice(0, 5) || '09:30', day_of_week: s.day_of_week })
    setShowModal(true)
  }

  const handleSave = async () => {
    const data = { ...form, day_of_week: parseInt(form.day_of_week) }
    try {
      if (editing) { await api.updateTimeSlot(editing.id, data) } else { await api.createTimeSlot(data) }
      toast.success(editing ? 'Đã cập nhật khung giờ!' : 'Đã thêm khung giờ mới!')
    } catch (err) {
      toast.error('Không thể lưu khung giờ: ' + err.message)
    }
    setShowModal(false); load()
  }

  const handleDelete = async (id) => {
    const ok = await confirm({
      title: 'Xóa khung giờ',
      message: 'Bạn có chắc chắn muốn xóa khung giờ này? Hành động này không thể hoàn tác.',
      confirmText: 'Xóa',
      variant: 'danger'
    })
    if (ok) {
      await api.deleteTimeSlot(id)
      toast.success('Đã xóa khung giờ.')
      load()
    }
  }

  const grouped = DAYS.map(d => ({ ...d, slots: slots.filter(s => s.day_of_week === d.value) }))

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Khung Giờ</h1><p className="page-subtitle">Định nghĩa các khung giờ học theo từng ngày trong tuần</p></div>
        <button className="btn-primary" onClick={openCreate}><Plus size={18} weight="bold" style={{ marginRight: 8 }} />Thêm khung giờ</button>
      </div>

      {slots.length === 0 ? (
        <div className="empty-state"><Clock size={64} weight="light" /><p>Chưa có khung giờ nào.</p></div>
      ) : (
        grouped.filter(g => g.slots.length > 0).map(g => (
          <div key={g.value} style={{ marginBottom: 'var(--space-xl)' }}>
            <h3 style={{ fontSize: 'var(--text-heading-sm-size)', fontWeight: 700, marginBottom: 'var(--space-sm)' }}>{g.label}</h3>
            <table className="data-table">
              <thead><tr><th>Nhãn</th><th>Bắt đầu</th><th>Kết thúc</th><th></th></tr></thead>
              <tbody>
                {g.slots.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 700 }}>{s.label}</td>
                    <td>{s.start_time?.slice(0, 5)}</td>
                    <td>{s.end_time?.slice(0, 5)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn-icon" onClick={() => openEdit(s)}><PencilSimple size={18} weight="light" /></button>
                        <button className="btn-icon" onClick={() => handleDelete(s.id)}><Trash size={18} weight="light" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{editing ? 'Chỉnh sửa' : 'Thêm mới'} Khung giờ</h2>
            <div className="form-group"><label className="form-label">Nhãn</label><input className="text-input" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="VD: 08:00 - 09:30" /></div>
            <div className="form-group">
              <label className="form-label">Ngày</label>
              <select className="select-input" value={form.day_of_week} onChange={e => setForm(f => ({ ...f, day_of_week: e.target.value }))}>
                {DAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <div className="form-group"><label className="form-label">Giờ bắt đầu</label><input className="text-input" type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Giờ kết thúc</label><input className="text-input" type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} /></div>
            </div>
            <div className="modal-actions">
              <button className="btn-outline btn-sm" onClick={() => setShowModal(false)}>Hủy</button>
              <button className="btn-primary btn-sm" onClick={handleSave}>Lưu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
