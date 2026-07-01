import { useState, useEffect } from 'react'
import { api } from '../services/api'
import { Plus, PencilSimple, Trash, Warning, Users as UsersIcon, Key, Copy } from '@phosphor-icons/react'
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
  const [restoreDuplicate, setRestoreDuplicate] = useState(null)
  const [createdAccount, setCreatedAccount] = useState(null)
  const [form, setForm] = useState({ full_name: '', short_name: '', username: '', email: '', phone: '', notes: '', capabilities: [] })

  const load = () => api.getPersons().then(setPersons).catch(console.error)
  useEffect(() => { load() }, [])

  const openCreate = () => { 
    setEditing(null); 
    setForm({ full_name: '', short_name: '', username: '', email: '', phone: '', notes: '', capabilities: [] }); 
    setShowModal(true) 
  }
  
  const openEdit = (p) => { 
    setEditing(p); 
    setForm({ 
      full_name: p.full_name, 
      short_name: p.short_name, 
      username: p.username || '', 
      email: p.email || '', 
      phone: p.phone || '', 
      notes: p.notes || '', 
      capabilities: p.capabilities || [] 
    }); 
    setShowModal(true) 
  }

  const handleSave = async () => {
    if (!form.full_name.trim() || !form.short_name.trim()) {
      toast.error('Vui lòng nhập đầy đủ Họ tên và Tên ngắn.')
      return
    }

    if (!editing && !form.username.trim()) {
      toast.error('Vui lòng nhập Tên đăng nhập cho tài khoản hệ thống của giáo viên này.')
      return
    }

    try {
      if (editing) {
        await api.updatePerson(editing.id, form)
        await api.setCapabilities(editing.id, form.capabilities)
        toast.success(`Đã cập nhật thông tin ${form.short_name}!`)
      } else {
        const res = await api.createPerson(form)
        setCreatedAccount({
          username: form.username.trim(),
          password: res.temp_password,
          email: form.email.trim() || '(Không có)'
        })
        toast.success(`Đã thêm mới giáo viên ${form.short_name} & tự động tạo tài khoản hệ thống!`)
      }
      setShowModal(false); load()
    } catch (err) {
      if (err.response?.error === 'InactiveDuplicate') {
        setRestoreDuplicate(err.response.person)
      } else {
        toast.error('Không thể lưu giáo viên/TA: ' + (err.response?.message || err.message))
      }
    }
  }

  const handleRestoreOld = async () => {
    if (!restoreDuplicate) return
    try {
      await api.updatePerson(restoreDuplicate.id, {
        full_name: restoreDuplicate.full_name,
        short_name: restoreDuplicate.short_name,
        email: restoreDuplicate.email || '',
        phone: restoreDuplicate.phone || '',
        notes: restoreDuplicate.notes || '',
        is_active: true
      })
      toast.success(`Đã khôi phục thành công giáo viên ${restoreDuplicate.short_name} với thông tin cũ!`)
      setRestoreDuplicate(null)
      setShowModal(false)
      load()
    } catch (err) {
      toast.error('Không thể khôi phục giáo viên: ' + err.message)
    }
  }

  const handleRestoreNew = async () => {
    if (!restoreDuplicate) return
    try {
      await api.updatePerson(restoreDuplicate.id, {
        ...form,
        is_active: true
      })
      await api.setCapabilities(restoreDuplicate.id, form.capabilities)
      toast.success(`Đã khôi phục và cập nhật thông tin mới cho giáo viên ${form.short_name}!`)
      setRestoreDuplicate(null)
      setShowModal(false)
      load()
    } catch (err) {
      toast.error('Không thể khôi phục giáo viên: ' + err.message)
    }
  }

  const handleDelete = async (id) => {
    const ok = await confirm({
      title: 'Xóa giáo viên / TA',
      message: 'Bạn có chắc chắn muốn xóa người này? Tài khoản hệ thống của họ sẽ bị vô hiệu hóa và họ sẽ bị loại khỏi tất cả các lịch phân công.',
      confirmText: 'Xóa',
      variant: 'danger'
    })
    if (ok) { await api.deletePerson(id); toast.success('Đã xóa thành công.'); load() }
  }

  const handleResetPassword = async (p) => {
    const ok = await confirm({
      title: 'Cấp lại mật khẩu',
      message: `Bạn có chắc chắn muốn cấp lại mật khẩu cho tài khoản ${p.username}? Giáo viên này sẽ bị buộc phải đổi mật khẩu ở lần đăng nhập tiếp theo.`,
      confirmText: 'Cấp lại',
      variant: 'warning'
    })
    if (!ok) return

    try {
      const res = await api.resetPersonPassword(p.id)
      setCreatedAccount({
        username: res.username,
        password: res.temp_password,
        email: res.email || '(Không có)'
      })
      toast.success(`Đã cấp lại mật khẩu cho tài khoản ${p.username}!`)
    } catch (err) {
      toast.error('Không thể cấp lại mật khẩu: ' + (err.response?.message || err.message))
    }
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
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead><tr><th>Tên ngắn</th><th>Họ tên</th><th>Năng lực</th><th>Liên hệ & Tài khoản</th><th></th></tr></thead>
            <tbody>
              {persons.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 700 }}>{p.short_name}</td>
                  <td>{p.full_name}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {(p.capabilities || []).map(c => (
                        <span key={c} className={`chip ${c.startsWith('ta') ? 'chip-pink' : 'chip-green'}`} data-tooltip={CAP_TOOLTIPS[c]}>{CAP_LABELS[c] || c}</span>
                      ))}
                    </div>
                  </td>
                  <td style={{ color: 'var(--color-mute)' }}>
                    <div>{p.phone || p.email || '—'}</div>
                    {p.username && (
                      <div style={{ fontSize: '12px', marginTop: '4px', color: 'var(--color-primary)' }}>
                        Tài khoản: <code style={{ background: 'var(--color-surface-soft)', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>{p.username}</code>
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {p.username && (
                        <button className="btn-icon" onClick={() => handleResetPassword(p)} title="Cấp lại mật khẩu"><Key size={18} weight="light" /></button>
                      )}
                      <button className="btn-icon" onClick={() => openEdit(p)}><PencilSimple size={18} weight="light" /></button>
                      <button className="btn-icon" onClick={() => handleDelete(p.id)}><Trash size={18} weight="light" /></button>
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
            <h2 className="modal-title">{editing ? 'Chỉnh sửa' : 'Thêm mới'} Giáo viên</h2>
            
            <div className="form-group">
              <label className="form-label">Tên đăng nhập hệ thống {!editing && <span style={{ color: '#e52020' }}>*</span>}</label>
              <input 
                className="text-input" 
                value={form.username} 
                onChange={e => setForm(f => ({ ...f, username: e.target.value.replace(/\s+/g, '').toLowerCase() }))} 
                disabled={!!editing}
                placeholder={editing ? "Tên đăng nhập đã được khóa cố định" : "Ví dụ: millie.nguyen (dùng để đăng nhập hệ thống)"}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Họ tên đầy đủ</label>
              <input className="text-input" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
            </div>
            
            <div className="form-group">
              <label className="form-label">Tên ngắn (duy nhất)</label>
              <input className="text-input" value={form.short_name} onChange={e => setForm(f => ({ ...f, short_name: e.target.value }))} />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="text-input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Được dùng để gửi mật khẩu khởi tạo..." />
              </div>
              <div className="form-group">
                <label className="form-label">Điện thoại</label>
                <input className="text-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            
            <div className="form-group">
              <label className="form-label">Năng lực</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {CAPABILITIES.map(cap => (
                  <button key={cap} onClick={() => toggleCap(cap)}
                    className={`chip ${form.capabilities.includes(cap) ? 'chip-green' : 'chip-gray'}`}
                    style={{ cursor: 'pointer', border: form.capabilities.includes(cap) ? '1px solid var(--color-primary)' : '1px solid var(--color-hairline)' }}
                    data-tooltip={CAP_TOOLTIPS[cap]}>
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

      {restoreDuplicate && (
        <div className="modal-overlay" onClick={() => setRestoreDuplicate(null)}>
          <div className="modal-content" style={{ maxWidth: '460px' }} onClick={e => e.stopPropagation()}>
            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-warning, #df6500)' }}>
              <Warning size={24} weight="fill" /> Khôi phục giáo viên cũ?
            </h2>
            <p style={{ fontSize: '15px', lineHeight: '1.6', marginBottom: 'var(--space-xl)', color: 'var(--color-body)' }}>
              Tên viết tắt <strong>{restoreDuplicate.short_name}</strong> đã tồn tại dưới dạng đã xóa (ẩn) trong hệ thống. Bạn có muốn khôi phục lại giáo viên này không?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button className="btn-primary" style={{ width: '100%', height: '40px' }} onClick={handleRestoreNew}>
                Khôi phục & Cập nhật thông tin mới vừa nhập
              </button>
              <button className="btn-outline" style={{ width: '100%', height: '40px', border: '1px solid var(--color-hairline)' }} onClick={handleRestoreOld}>
                Khôi phục & Giữ nguyên thông tin cũ
              </button>
              <button className="btn-ghost-link" style={{ textAlign: 'center', marginTop: '8px', cursor: 'pointer', background: 'none', border: 'none', color: 'var(--color-mute)' }} onClick={() => setRestoreDuplicate(null)}>
                Hủy và quay lại chỉnh sửa
              </button>
            </div>
          </div>
        </div>
      )}

      {createdAccount && (
        <div className="modal-overlay" onClick={() => setCreatedAccount(null)}>
          <div className="modal-content" style={{ maxWidth: '460px' }} onClick={e => e.stopPropagation()}>
            <h2 className="modal-title" style={{ color: 'var(--color-primary)' }}>
              Tài Khoản Đã Khởi Tạo!
            </h2>
            <p style={{ fontSize: '14px', marginBottom: 'var(--space-md)', color: 'var(--color-body)' }}>
              Tài khoản hệ thống của giáo viên/TA đã được tạo thành công. Vui lòng gửi thông tin này cho họ:
            </p>
            <div style={{ background: 'var(--color-surface-soft)', padding: 'var(--space-md)', borderRadius: '4px', marginBottom: 'var(--space-lg)', border: '1px solid var(--color-hairline)' }}>
              <div style={{ marginBottom: '8px', color: 'var(--text-h)' }}>
                Tên đăng nhập: <strong style={{ fontFamily: 'monospace', fontSize: '15px' }}>{createdAccount.username}</strong>
              </div>
              <div style={{ marginBottom: '8px', color: 'var(--text-h)' }}>
                Mật khẩu tạm thời: <strong style={{ fontFamily: 'monospace', color: 'var(--color-primary)', fontSize: '15px' }}>{createdAccount.password}</strong>
              </div>
              <div style={{ color: 'var(--text-h)', marginBottom: '14px' }}>
                Email liên kết: <span style={{ fontFamily: 'monospace' }}>{createdAccount.email}</span>
              </div>
              
              <button 
                type="button"
                className="btn-outline" 
                style={{ 
                  width: '100%', 
                  height: '34px',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  borderRadius: '4px',
                  border: '1px solid var(--color-hairline)',
                  background: 'var(--color-canvas)'
                }}
                onClick={() => {
                  const text = `Tài khoản LotusTime:\nTên đăng nhập: ${createdAccount.username}\nMật khẩu tạm thời: ${createdAccount.password}\nEmail: ${createdAccount.email}`;
                  navigator.clipboard.writeText(text);
                  toast.success('Đã sao chép thông tin tài khoản!');
                }}
              >
                <Copy size={16} /> Sao chép thông tin
              </button>
            </div>
            {createdAccount.email !== '(Không có)' ? (
              <p style={{ fontSize: '12px', color: 'var(--color-mute)', marginBottom: 'var(--space-lg)' }}>
                * Một email tự động chứa thông tin đăng nhập cũng đã được gửi đến địa chỉ email của giáo viên này.
              </p>
            ) : (
              <p style={{ fontSize: '12px', color: 'var(--color-warning, #df6500)', marginBottom: 'var(--space-lg)', fontWeight: 'bold' }}>
                * Lưu ý: Do không cung cấp email, admin bắt buộc phải copy mật khẩu trên để gửi thủ công cho giáo viên.
              </p>
            )}
            <button className="btn-primary" style={{ width: '100%', height: '40px', justifyContent: 'center' }} onClick={() => setCreatedAccount(null)}>
              Đồng ý & Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
