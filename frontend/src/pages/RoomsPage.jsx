import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { Plus, PencilSimple, Trash, Door } from '@phosphor-icons/react'
import { useToast } from '../components/layout/Toast'
import { useConfirm } from '../components/layout/ConfirmModal'

export default function RoomsPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const [rooms, setRooms] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', capacity: '' })

  const load = () => api.getRooms().then(setRooms).catch(console.error)
  useEffect(() => { load() }, [])

  const openCreate = () => { setEditing(null); setForm({ name: '', capacity: '' }); setShowModal(true) }
  const openEdit = (r) => { setEditing(r); setForm({ name: r.name, capacity: r.capacity || '' }); setShowModal(true) }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Vui lòng nhập Tên phòng.')
      return
    }
    const data = { name: form.name, capacity: form.capacity ? parseInt(form.capacity) : null }
    try {
      if (editing) {
        await api.updateRoom(editing.id, data)
        toast.success(`Đã cập nhật phòng ${form.name}!`)
      } else {
        await api.createRoom(data)
        toast.success(`Đã tạo phòng ${form.name}!`)
      }
      setShowModal(false); load()
    } catch (err) {
      toast.error('Không thể lưu phòng học: ' + err.message)
    }
  }

  const handleDelete = async (id) => {
    const ok = await confirm({
      title: 'Xóa phòng học',
      message: 'Bạn có chắc chắn muốn xóa phòng học này?',
      confirmText: 'Xóa',
      variant: 'danger'
    })
    if (ok) { await api.deleteRoom(id); toast.success('Đã xóa phòng học.'); load() }
  }

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Phòng Học</h1><p className="page-subtitle">Quản lý phòng học và sức chứa</p></div>
        <button className="btn-primary" onClick={openCreate}><Plus size={18} weight="bold" style={{ marginRight: 8 }} />Thêm phòng</button>
      </div>

      {rooms.length === 0 ? (
        <div className="empty-state"><Door size={64} weight="light" /><p>Chưa có phòng học nào.</p></div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead><tr><th>Tên phòng</th><th>Sức chứa</th><th></th></tr></thead>
            <tbody>
              {rooms.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 700 }}>{r.name}</td>
                  <td>{r.capacity || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-icon" onClick={() => openEdit(r)}><PencilSimple size={18} weight="light" /></button>
                      <button className="btn-icon" onClick={() => handleDelete(r.id)}><Trash size={18} weight="light" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{editing ? 'Chỉnh sửa' : 'Thêm mới'} Phòng học</h2>
            <div className="form-group"><label className="form-label">Tên phòng</label><input className="text-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Sức chứa (số học sinh)</label><input className="text-input" type="number" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} /></div>
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
