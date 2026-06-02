import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { Plus, PencilSimple, Trash, Users as UsersIcon } from '@phosphor-icons/react'
import { useToast } from '../components/layout/Toast'
import { useConfirm } from '../components/layout/ConfirmModal'

const CAPABILITIES = ['lead_teacher', 'foreign_teacher', 'ta_support', 'ta_solo', 'ta_ielts', 'ta_kids']
const CAP_LABELS = { lead_teacher: 'GV Chính', foreign_teacher: 'GV Nước ngoài', ta_support: 'TA Hỗ trợ', ta_solo: 'TA Độc lập', ta_ielts: 'TA IELTS', ta_kids: 'TA Kids' }
const CAP_TOOLTIPS = {
  lead_teacher: 'Giáo viên chính (Việt): Giảng dạy chính, giải thích ngữ pháp, quản lý lớp',
  foreign_teacher: 'Giáo viên nước ngoài: Luyện nghe nói, phát âm, phản xạ giao tiếp',
  ta_support: 'Trợ giảng hỗ trợ: Điểm danh, quản lý học sinh và hỗ trợ GV chính',
  ta_solo: 'Trợ giảng độc lập: Có thể đứng lớp độc lập dạy ôn tập, sửa bài tập',
  ta_ielts: 'Trợ giảng IELTS: Chuyên hỗ trợ lớp IELTS, chấm/sửa bài Writing & Speaking',
  ta_kids: 'Trợ giảng Kids: Chuyên hỗ trợ lớp trẻ em, hoạt náo và theo sát trẻ nhỏ'
}

export default function PersonsPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const [persons, setPersons] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ full_name: '', short_name: '', email: '', phone: '', notes: '', capabilities: [] })

  const load = () => api.getPersons().then(setPersons).catch(console.error)
  useEffect(() => { load() }, [])

  const openCreate = () => { setEditing(null); setForm({ full_name: '', short_name: '', email: '', phone: '', notes: '', capabilities: [] }); setShowModal(true) }
  const openEdit = (p) => { setEditing(p); setForm({ full_name: p.full_name, short_name: p.short_name, email: p.email || '', phone: p.phone || '', notes: p.notes || '', capabilities: p.capabilities || [] }); setShowModal(true) }

  const handleSave = async () => {
    if (!form.full_name.trim() || !form.short_name.trim()) {
      toast.error('Vui lòng nhập đầy đủ Họ tên và Tên ngắn.')
      return
    }
    try {
      if (editing) {
        await api.updatePerson(editing.id, form)
        await api.setCapabilities(editing.id, form.capabilities)
        toast.success(`Đã cập nhật thông tin ${form.short_name}!`)
      } else {
        await api.createPerson(form)
        toast.success(`Đã thêm mới giáo viên ${form.short_name}!`)
      }
      setShowModal(false); load()
    } catch (err) {
      toast.error('Không thể lưu giáo viên/TA: ' + err.message)
    }
  }

  const handleDelete = async (id) => {
    const ok = await confirm({
      title: 'Xóa giáo viên / TA',
      message: 'Bạn có chắc chắn muốn xóa người này? Họ sẽ bị loại khỏi tất cả các lịch phân công.',
      confirmText: 'Xóa',
      variant: 'danger'
    })
    if (ok) { await api.deletePerson(id); toast.success('Đã xóa thành công.'); load() }
  }

  const toggleCap = (cap) => {
    setForm(f => ({ ...f, capabilities: f.capabilities.includes(cap) ? f.capabilities.filter(c => c !== cap) : [...f.capabilities, cap] }))
  }

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Giáo Viên & Trợ Giảng</h1><p className="page-subtitle">Quản lý nhân sự và năng lực giảng dạy</p></div>
        <button className="btn-primary" onClick={openCreate}><Plus size={18} weight="bold" style={{ marginRight: 8 }} />Thêm mới</button>
      </div>

      {persons.length === 0 ? (
        <div className="empty-state"><UsersIcon size={64} weight="light" /><p>Chưa có giáo viên nào. Hãy thêm người đầu tiên.</p></div>
      ) : (
        <table className="data-table">
          <thead><tr><th>Tên ngắn</th><th>Họ tên</th><th>Năng lực</th><th>Liên hệ</th><th></th></tr></thead>
          <tbody>
            {persons.map(p => (
              <tr key={p.id}>
                <td style={{ fontWeight: 700 }}>{p.short_name}</td>
                <td>{p.full_name}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {(p.capabilities || []).map(c => (
                      <span key={c} className={`chip ${c.startsWith('ta') ? 'chip-pink' : 'chip-green'}`} data-tooltip={CAP_TOOLTIPS[c]} title={CAP_TOOLTIPS[c]}>{CAP_LABELS[c] || c}</span>
                    ))}
                  </div>
                </td>
                <td style={{ color: 'var(--color-mute)' }}>{p.phone || p.email || '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn-icon" onClick={() => openEdit(p)}><PencilSimple size={18} weight="light" /></button>
                    <button className="btn-icon" onClick={() => handleDelete(p.id)}><Trash size={18} weight="light" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{editing ? 'Chỉnh sửa' : 'Thêm mới'} Giáo viên</h2>
            <div className="form-group">
              <label className="form-label">Họ tên đầy đủ</label>
              <input className="text-input" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Tên ngắn (duy nhất)</label>
              <input className="text-input" value={form.short_name} onChange={e => setForm(f => ({ ...f, short_name: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <div className="form-group"><label className="form-label">Email</label><input className="text-input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Điện thoại</label><input className="text-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
            </div>
            <div className="form-group">
              <label className="form-label">Năng lực</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {CAPABILITIES.map(cap => (
                  <button key={cap} onClick={() => toggleCap(cap)}
                    className={`chip ${form.capabilities.includes(cap) ? 'chip-green' : 'chip-gray'}`}
                    style={{ cursor: 'pointer', border: form.capabilities.includes(cap) ? '1px solid var(--color-primary)' : '1px solid var(--color-hairline)' }}
                    data-tooltip={CAP_TOOLTIPS[cap]}
                    title={CAP_TOOLTIPS[cap]}>
                    {CAP_LABELS[cap]}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group"><label className="form-label">Ghi chú</label><input className="text-input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
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
