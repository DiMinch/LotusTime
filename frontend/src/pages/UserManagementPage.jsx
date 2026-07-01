import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Plus, PencilSimple, Trash, Key, Users, Check, Prohibit } from '@phosphor-icons/react';
import { useToast } from '../components/layout/Toast';
import { useConfirm } from '../components/layout/ConfirmModal';

export default function UserManagementPage() {
  const toast = useToast();
  const confirm = useConfirm();

  const [users, setUsers] = useState([]);
  const [persons, setPersons] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);

  // Form states
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'staff',
    person_id: ''
  });

  const [resetPasswordVal, setResetPasswordVal] = useState('');

  const loadData = async () => {
    try {
      const [usersData, personsData] = await Promise.all([
        api.getUsers(),
        api.getPersons()
      ]);
      setUsers(usersData);
      setPersons(personsData);
    } catch (err) {
      console.error('Failed to load user management data', err);
      toast.error('Không thể tải danh sách tài khoản.');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({
      username: '',
      email: '',
      password: '',
      role: 'staff',
      person_id: ''
    });
    setShowModal(true);
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({
      username: u.username,
      email: u.email,
      password: '', // Password not editable here
      role: u.role,
      person_id: u.person_id || ''
    });
    setShowModal(true);
  };

  const openResetPassword = (u) => {
    setResetTarget(u);
    setResetPasswordVal('');
    setShowResetModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.email.trim()) {
      toast.error('Tên đăng nhập và Email không được để trống.');
      return;
    }

    if (!editing && !form.password.trim()) {
      toast.error('Mật khẩu là bắt buộc khi tạo tài khoản mới.');
      return;
    }

    const payload = {
      username: form.username.trim(),
      email: form.email.trim(),
      role: form.role,
      person_id: form.person_id ? form.person_id : null
    };

    if (!editing) {
      payload.password = form.password;
    }

    try {
      if (editing) {
        await api.updateUser(editing.id, payload);
        toast.success(`Đã cập nhật tài khoản ${form.username}!`);
      } else {
        await api.createUser(payload);
        toast.success(`Đã tạo tài khoản ${form.username}!`);
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi lưu tài khoản.');
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!resetPasswordVal.trim()) {
      toast.error('Mật khẩu mới không được để trống.');
      return;
    }
    if (resetPasswordVal.length < 6) {
      toast.error('Mật khẩu phải chứa ít nhất 6 ký tự.');
      return;
    }

    try {
      await api.resetUserPassword(resetTarget.id, resetPasswordVal);
      toast.success(`Đã đặt lại mật khẩu cho tài khoản ${resetTarget.username}!`);
      setShowResetModal(false);
    } catch (err) {
      toast.error(err.message || 'Lỗi đặt lại mật khẩu.');
    }
  };

  const handleToggleStatus = async (userObj) => {
    const actionText = userObj.is_active ? 'Khóa' : 'Mở khóa';
    const ok = await confirm({
      title: `${actionText} tài khoản`,
      message: `Bạn có chắc muốn ${actionText.toLowerCase()} tài khoản ${userObj.username}?`,
      confirmText: actionText,
      variant: userObj.is_active ? 'danger' : 'success'
    });

    if (ok) {
      try {
        await api.toggleUserStatus(userObj.id, !userObj.is_active);
        toast.success(`Đã ${actionText.toLowerCase()} tài khoản ${userObj.username}.`);
        loadData();
      } catch (err) {
        toast.error(err.message || 'Lỗi cập nhật trạng thái.');
      }
    }
  };

  const handleDelete = async (userObj) => {
    const ok = await confirm({
      title: 'Xóa tài khoản',
      message: `Tài khoản ${userObj.username} sẽ bị xóa khỏi hệ thống. Thao tác này không thể hoàn tác. Bạn có chắc chắn muốn xóa?`,
      confirmText: 'Xóa',
      variant: 'danger'
    });

    if (ok) {
      try {
        await api.deleteUser(userObj.id);
        toast.success(`Đã xóa tài khoản ${userObj.username}.`);
        loadData();
      } catch (err) {
        toast.error(err.message || 'Lỗi xóa tài khoản.');
      }
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('vi-VN');
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Quản Lý Tài Khoản</h1>
          <p className="page-subtitle">Quản lý người dùng, phân quyền RBAC và liên kết nhân sự</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <Plus size={18} weight="bold" style={{ marginRight: 8 }} />
          Thêm tài khoản
        </button>
      </div>

      {users.length === 0 ? (
        <div className="empty-state">
          <Users size={64} weight="light" />
          <p>Chưa có tài khoản nào được đăng ký.</p>
        </div>
      ) : (
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tên đăng nhập</th>
                <th>Email</th>
                <th>Vai trò</th>
                <th>Liên kết nhân sự</th>
                <th>Ngày tạo</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 700 }}>{u.username}</td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`chip ${u.role === 'admin' ? 'chip-green' : 'chip-gray'}`} style={{ margin: 0 }}>
                      {u.role === 'admin' ? 'Admin' : 'Nhân viên'}
                    </span>
                  </td>
                  <td>
                    {u.person_short_name ? (
                      <span style={{ color: 'var(--text-h)' }}>
                        {u.person_full_name} ({u.person_short_name})
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-mute)' }}>—</span>
                    )}
                  </td>
                  <td>{formatDate(u.created_at)}</td>
                  <td>
                    <span className={`chip ${u.is_active ? 'chip-green' : 'chip-red'}`} style={{ margin: 0, opacity: u.is_active ? 1 : 0.6 }}>
                      {u.is_active ? 'Hoạt động' : 'Tạm khóa'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-icon" title="Sửa tài khoản" onClick={() => openEdit(u)}>
                        <PencilSimple size={18} weight="light" />
                      </button>
                      <button className="btn-icon" title="Đặt lại mật khẩu" onClick={() => openResetPassword(u)}>
                        <Key size={18} weight="light" />
                      </button>
                      <button 
                        className="btn-icon" 
                        title={u.is_active ? 'Khóa tài khoản' : 'Kích hoạt tài khoản'} 
                        onClick={() => handleToggleStatus(u)}
                        style={{ color: u.is_active ? 'var(--color-warning)' : 'var(--color-success-deep)' }}
                      >
                        {u.is_active ? <Prohibit size={18} weight="light" /> : <Check size={18} weight="bold" />}
                      </button>
                      <button 
                        className="btn-icon" 
                        title="Xóa tài khoản" 
                        onClick={() => handleDelete(u)}
                        style={{ color: 'var(--color-error)' }}
                      >
                        <Trash size={18} weight="light" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h2 className="modal-title">{editing ? 'Chỉnh sửa' : 'Thêm mới'} Tài khoản</h2>
            
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Tên đăng nhập</label>
                <input 
                  className="text-input" 
                  value={form.username} 
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  required
                  placeholder="VD: nguyenvana"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Địa chỉ Email</label>
                <input 
                  className="text-input" 
                  type="email"
                  value={form.email} 
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                  placeholder="VD: nguyenvana@gmail.com"
                />
              </div>

              {!editing && (
                <div className="form-group">
                  <label className="form-label">Mật khẩu khởi tạo</label>
                  <input 
                    className="text-input" 
                    type="password"
                    value={form.password} 
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    required
                    placeholder="Nhập mật khẩu ban đầu..."
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Vai trò hệ thống</label>
                <select 
                  className="text-input" 
                  value={form.role} 
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  style={{ background: 'var(--color-surface)', color: 'var(--text-h)' }}
                >
                  <option value="staff">Nhân viên (Center Staff)</option>
                  <option value="admin">Quản trị viên (Admin)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Liên kết nhân sự Giáo viên/TA (Không bắt buộc)</label>
                <select 
                  className="text-input" 
                  value={form.person_id} 
                  onChange={e => setForm(f => ({ ...f, person_id: e.target.value }))}
                  style={{ background: 'var(--color-surface)', color: 'var(--text-h)' }}
                >
                  <option value="">-- Không liên kết --</option>
                  {persons.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} ({p.short_name})
                    </option>
                  ))}
                </select>
                <p style={{ fontSize: '12px', color: 'var(--color-mute)', marginTop: 4 }}>
                  Liên kết tài khoản này với một giáo viên hoặc trợ giảng trong danh sách nhân sự của trung tâm.
                </p>
              </div>

              <div className="modal-actions" style={{ marginTop: 'var(--space-xl)' }}>
                <button type="button" className="btn-outline btn-sm" onClick={() => setShowModal(false)}>Hủy</button>
                <button type="submit" className="btn-primary btn-sm">Lưu</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetModal && (
        <div className="modal-overlay" onClick={() => setShowResetModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h2 className="modal-title">Đặt lại mật khẩu</h2>
            <p style={{ fontSize: '14px', color: 'var(--color-mute)', marginBottom: 'var(--space-lg)' }}>
              Đang đặt lại mật khẩu cho tài khoản <strong>{resetTarget?.username}</strong>.
            </p>
            
            <form onSubmit={handleResetPasswordSubmit}>
              <div className="form-group">
                <label className="form-label">Mật khẩu mới (Tối thiểu 6 ký tự)</label>
                <input 
                  type="password"
                  className="text-input" 
                  value={resetPasswordVal} 
                  onChange={e => setResetPasswordVal(e.target.value)}
                  required
                  placeholder="Nhập mật khẩu mới..."
                  autoFocus
                />
              </div>

              <div className="modal-actions" style={{ marginTop: 'var(--space-xl)' }}>
                <button type="button" className="btn-outline btn-sm" onClick={() => setShowResetModal(false)}>Hủy</button>
                <button type="submit" className="btn-primary btn-sm">Đặt lại</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
