import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { Plus, PencilSimple, Trash, ChalkboardTeacher, ListPlus, X, LockKey } from '@phosphor-icons/react'
import { useToast } from '../components/layout/Toast'
import { useConfirm } from '../components/layout/ConfirmModal'

const CLASS_TYPES = [
  { value: 'regular', label: 'Thông thường' },
  { value: 'kids', label: 'Kids' },
  { value: 'cambridge', label: 'Cambridge' },
  { value: 'ielts', label: 'IELTS' },
]
const TYPE_CHIP = { regular: 'chip-gray', kids: 'chip-pink', cambridge: 'chip-green', ielts: 'chip-green' }

const SEGMENT_ROLES = [
  { value: '', label: '— Bất kỳ —' },
  { value: 'lead_teacher', label: 'GV Chính (Việt)' },
  { value: 'foreign_teacher', label: 'GV Nước ngoài' },
  { value: 'ta_support', label: 'TA Hỗ trợ' },
  { value: 'ta_solo', label: 'TA Độc lập' },
  { value: 'ta_ielts', label: 'TA IELTS' },
]

const EMPTY_FORM = {
  code: '', class_type: 'regular', level: '', student_count: '',
  sessions_per_week: 2, duration_minutes: 90, requires_ta: false, notes: '',
  segments: null, allowed_persons: [], allow_same_day: false
}

export default function ClassesPage() {
  const toast = useToast()
  const confirm = useConfirm()
  const [classes, setClasses] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })

  const [persons, setPersons] = useState([])

  const load = () => {
    api.getClasses().then(setClasses).catch(console.error)
    api.getPersons().then(setPersons).catch(console.error)
  }
  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setShowModal(true)
  }
  const openEdit = (c) => {
    setEditing(c)
    setForm({
      code: c.code, class_type: c.class_type, level: c.level || '',
      student_count: c.student_count || '',
      sessions_per_week: c.sessions_per_week, duration_minutes: c.duration_minutes,
      requires_ta: c.requires_ta, notes: c.notes || '',
      segments: c.segments || null,
      allowed_persons: c.permissions ? c.permissions.map(p => p.person_id) : [],
      allow_same_day: !!c.allow_same_day
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.code.trim()) {
      toast.error('Vui lòng nhập Mã lớp.')
      return
    }
    const data = {
      ...form,
      sessions_per_week: parseInt(form.sessions_per_week),
      duration_minutes: parseInt(form.duration_minutes),
      student_count: form.student_count ? parseInt(form.student_count) : null,
      segments: form.segments && form.segments.length > 0 ? form.segments : null
    }
    try {
      let savedClassId;
      if (editing) {
        await api.updateClass(editing.id, data)
        savedClassId = editing.id
        toast.success(`Đã cập nhật lớp ${form.code}!`)
      } else {
        const newClass = await api.createClass(data)
        savedClassId = newClass.id
        toast.success(`Đã tạo lớp ${form.code}!`)
      }
      
      // Save permissions
      const perms = form.allowed_persons.map(pid => ({ person_id: pid, allowed_roles: ['any'] }))
      await api.setClassPermissions(savedClassId, perms)
      
      setShowModal(false); load()
    } catch (err) {
      toast.error('Không thể lưu lớp học: ' + err.message)
    }
  }

  const handleDelete = async (id) => {
    const ok = await confirm({
      title: 'Xóa lớp học',
      message: 'Bạn có chắc chắn muốn xóa lớp học này? Thông tin sẽ bị ẩn khỏi hệ thống.',
      confirmText: 'Xóa',
      variant: 'danger'
    })
    if (ok) { await api.deleteClass(id); toast.success('Đã xóa lớp học.'); load() }
  }

  // --- Segments helpers ---
  const enableSegments = () => {
    const dur = parseInt(form.duration_minutes) || 90
    setForm(f => ({
      ...f,
      segments: [
        { label: 'Phân đoạn 1', duration_minutes: Math.floor(dur / 2), required_capability: 'lead_teacher' },
        { label: 'Phân đoạn 2', duration_minutes: Math.ceil(dur / 2), required_capability: 'foreign_teacher' },
      ]
    }))
  }

  const disableSegments = () => {
    setForm(f => ({ ...f, segments: null }))
  }

  const updateSegment = (idx, key, value) => {
    setForm(f => {
      const segs = [...f.segments]
      segs[idx] = { ...segs[idx], [key]: value }
      return { ...f, segments: segs }
    })
  }

  const addSegment = () => {
    setForm(f => ({
      ...f,
      segments: [...(f.segments || []), { label: `Phân đoạn ${(f.segments?.length || 0) + 1}`, duration_minutes: 60, required_capability: '' }]
    }))
  }

  const removeSegment = (idx) => {
    setForm(f => {
      const segs = f.segments.filter((_, i) => i !== idx)
      return { ...f, segments: segs.length > 0 ? segs : null }
    })
  }

  // Auto-calc total duration from segments
  const segmentTotal = form.segments ? form.segments.reduce((sum, s) => sum + (parseInt(s.duration_minutes) || 0), 0) : 0

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Lớp Học</h1>
          <p className="page-subtitle">Quản lý lớp, loại hình và yêu cầu buổi học</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <Plus size={18} weight="bold" style={{ marginRight: 8 }} />Thêm lớp
        </button>
      </div>

      {classes.length === 0 ? (
        <div className="empty-state">
          <ChalkboardTeacher size={64} weight="light" />
          <p>Chưa có lớp nào. Thêm lớp đầu tiên.</p>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr><th>Mã lớp</th><th>Loại</th><th>Trình độ</th><th>HS</th><th>Buổi/tuần</th><th>Thời lượng</th><th>Cấu trúc</th><th></th></tr>
          </thead>
          <tbody>
            {classes.map(c => (
              <tr key={c.id}>
                <td style={{ fontWeight: 700 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {c.code}
                    {c.permissions && c.permissions.length > 0 && (
                      <LockKey size={14} weight="fill" color="var(--color-warning)" title={`Chỉ định ${c.permissions.length} GV/TA`} />
                    )}
                  </div>
                </td>
                <td><span className={`chip ${TYPE_CHIP[c.class_type] || 'chip-gray'}`}>
                  {CLASS_TYPES.find(t => t.value === c.class_type)?.label || c.class_type}
                </span></td>
                <td>{c.level || '—'}</td>
                <td>{c.student_count || '—'}</td>
                <td>{c.sessions_per_week}</td>
                <td>{c.duration_minutes} phút</td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {c.segments && c.segments.length > 1
                      ? <span className="chip chip-pink">{c.segments.length} phân đoạn</span>
                      : c.requires_ta
                        ? <span className="chip chip-pink">Cần TA</span>
                        : <span className="chip chip-gray">Đơn giản</span>
                    }
                    {c.allow_same_day && (
                      <span className="chip chip-green" style={{ fontSize: '10px' }}>Học cùng ngày</span>
                    )}
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn-icon" onClick={() => openEdit(c)}><PencilSimple size={18} weight="light" /></button>
                    <button className="btn-icon" onClick={() => handleDelete(c.id)}><Trash size={18} weight="light" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <h2 className="modal-title">{editing ? 'Chỉnh sửa' : 'Thêm mới'} Lớp học</h2>

            {/* Row 1: Code + Type */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <div className="form-group">
                <label className="form-label">Mã lớp *</label>
                <input className="text-input" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Loại lớp</label>
                <select className="select-input" value={form.class_type} onChange={e => setForm(f => ({ ...f, class_type: e.target.value }))}>
                  {CLASS_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            {/* Row 2: Level + Student count */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <div className="form-group">
                <label className="form-label">Trình độ</label>
                <input className="text-input" value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))} placeholder="VD: Gr.9, Starters..." />
              </div>
              <div className="form-group">
                <label className="form-label">Số học sinh</label>
                <input className="text-input" type="number" value={form.student_count} onChange={e => setForm(f => ({ ...f, student_count: e.target.value }))} placeholder="VD: 15" />
              </div>
            </div>

            {/* Row 3: Sessions/week + Total duration */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <div className="form-group">
                <label className="form-label">Số buổi/tuần</label>
                <input className="text-input" type="number" value={form.sessions_per_week} onChange={e => setForm(f => ({ ...f, sessions_per_week: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Tổng thời lượng/buổi (phút)</label>
                <input className="text-input" type="number" value={form.segments ? segmentTotal : form.duration_minutes}
                  disabled={!!form.segments}
                  onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))}
                  style={form.segments ? { opacity: 0.5 } : {}}
                />
                {form.segments && <p style={{ fontSize: 'var(--text-caption-sm-size)', color: 'var(--color-mute)', marginTop: 2 }}>Tự tính từ tổng phân đoạn</p>}
              </div>
            </div>

            {/* TA checkbox */}
            {!form.segments && (
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                <input type="checkbox" id="requires_ta" checked={form.requires_ta} onChange={e => setForm(f => ({ ...f, requires_ta: e.target.checked }))} />
                <label htmlFor="requires_ta" style={{ fontSize: 'var(--text-body-md-size)' }}>Lớp này cần Trợ giảng (TA)</label>
              </div>
            )}

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginTop: '-8px', marginBottom: 'var(--space-md)' }}>
              <input type="checkbox" id="allow_same_day" checked={form.allow_same_day} onChange={e => setForm(f => ({ ...f, allow_same_day: e.target.checked }))} />
              <label htmlFor="allow_same_day" style={{ fontSize: 'var(--text-body-md-size)' }}>Cho phép xếp các buổi học trong cùng một ngày</label>
            </div>

            {/* Segments Editor */}
            <div style={{ border: '1px solid var(--color-hairline)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-md)', marginBottom: 'var(--space-md)', background: 'var(--color-surface-soft)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                <label className="form-label" style={{ marginBottom: 0, fontWeight: 700 }}>Phân đoạn buổi học</label>
                {!form.segments
                  ? <button className="btn-outline btn-sm" type="button" onClick={enableSegments}><ListPlus size={16} style={{ marginRight: 4 }} /> Bật phân đoạn</button>
                  : <button className="btn-outline btn-sm" type="button" onClick={disableSegments} style={{ color: 'var(--color-accent)' }}><X size={16} style={{ marginRight: 4 }} /> Tắt phân đoạn</button>
                }
              </div>

              {!form.segments ? (
                <p style={{ fontSize: 'var(--text-caption-sm-size)', color: 'var(--color-mute)' }}>
                  Mặc định: 1 buổi = 1 GV duy nhất.<br />
                  Bật phân đoạn nếu buổi học gồm nhiều phần với GV khác nhau (VD: 1h GV Việt + 1h GV nước ngoài).
                </p>
              ) : (
                <div>
                  {form.segments.map((seg, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr auto', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)', alignItems: 'center' }}>
                      <input className="text-input" value={seg.label} placeholder="Tên phân đoạn"
                        onChange={e => updateSegment(idx, 'label', e.target.value)}
                        style={{ fontSize: 'var(--text-body-sm-size)' }}
                      />
                      <input className="text-input" type="number" value={seg.duration_minutes} placeholder="Phút"
                        onChange={e => updateSegment(idx, 'duration_minutes', parseInt(e.target.value) || 0)}
                        style={{ fontSize: 'var(--text-body-sm-size)' }}
                      />
                      <select className="select-input" value={seg.required_capability}
                        onChange={e => updateSegment(idx, 'required_capability', e.target.value)}
                        style={{ fontSize: 'var(--text-body-sm-size)' }}
                      >
                        {SEGMENT_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                      <button className="btn-icon" type="button" onClick={() => removeSegment(idx)} title="Xóa phân đoạn">
                        <X size={16} color="var(--color-accent)" />
                      </button>
                    </div>
                  ))}
                  <button className="btn-outline btn-sm" type="button" onClick={addSegment} style={{ marginTop: 'var(--space-xs)' }}>
                    <Plus size={14} style={{ marginRight: 4 }} /> Thêm phân đoạn
                  </button>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="form-group">
              <label className="form-label">Ghi chú</label>
              <input className="text-input" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            {/* Allowed Persons */}
            <div className="form-group">
              <label className="form-label">Giáo viên & TA được phép dạy (Tùy chọn)</label>
              <p style={{ fontSize: 'var(--text-caption-sm-size)', color: 'var(--color-mute)', marginBottom: 'var(--space-xs)' }}>
                Nếu để trống, AI sẽ tự do xếp bất kỳ ai có kỹ năng phù hợp. Nếu đánh dấu, <b>CHỈ</b> những người này mới được xếp vào lớp.
              </p>
              <div style={{ border: '1px solid var(--color-hairline)', borderRadius: 'var(--radius-sm)', padding: 'var(--space-sm)', maxHeight: 150, overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'var(--color-surface)' }}>
                {persons.map(p => (
                  <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 4, cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      style={{ accentColor: 'var(--color-primary)' }}
                      checked={form.allowed_persons.includes(p.id)}
                      onChange={e => {
                        const checked = e.target.checked
                        setForm(f => ({
                          ...f,
                          allowed_persons: checked 
                            ? [...f.allowed_persons, p.id]
                            : f.allowed_persons.filter(id => id !== p.id)
                        }))
                      }}
                    />
                    <span style={{ fontSize: 'var(--text-body-sm-size)' }}>{p.short_name} <span style={{ color: 'var(--color-mute)' }}>({p.capabilities?.length || 0} skills)</span></span>
                  </label>
                ))}
              </div>
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
