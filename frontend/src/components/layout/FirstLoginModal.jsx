import React, { useState } from 'react';
import { useAuth } from '../../services/AuthContext';
import { api } from '../../services/api';
import { useToast } from './Toast';
import { Lock, FloppyDisk, SignOut, Key, Eye, EyeSlash } from '@phosphor-icons/react';

export default function FirstLoginModal() {
  const { logout, updateFirstLoginFlag } = useAuth();
  const toast = useToast();
  
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error('Vui lòng nhập đầy đủ tất cả các trường.');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Mật khẩu mới phải chứa ít nhất 6 ký tự.');
      return;
    }

    if (newPassword === oldPassword) {
      toast.error('Mật khẩu mới không được trùng với mật khẩu cũ.');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu nhập lại không khớp.');
      return;
    }

    setSubmitting(false);
    try {
      setSubmitting(true);
      await api.changePassword(oldPassword, newPassword);
      toast.success('Đổi mật khẩu thành công! Chào mừng bạn đến với LotusTime.');
      updateFirstLoginFlag(false);
    } catch (err) {
      if (err.response?.error === 'InvalidOldPassword') {
        toast.error('Mật khẩu cũ (mật khẩu mặc định/được cấp) không chính xác.');
      } else {
        toast.error(err.message || 'Thay đổi mật khẩu thất bại.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ background: 'rgba(10, 11, 14, 0.95)', zIndex: 9999 }}>
      <div className="modal-content" style={{ maxWidth: '450px', border: '1px solid var(--color-hairline)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
          <div style={{ display: 'inline-flex', padding: '12px', background: 'rgba(118, 185, 0, 0.1)', color: 'var(--color-primary)', borderRadius: '50%', marginBottom: '12px' }}>
            <Key size={32} weight="light" />
          </div>
          <h2 className="modal-title" style={{ margin: 0, fontSize: '20px', color: 'var(--text-h)' }}>Đổi Mật Khẩu Lần Đầu</h2>
          <p style={{ fontSize: '13px', color: 'var(--color-mute)', marginTop: '8px', lineHeight: '1.5' }}>
            Đây là lần đầu tiên bạn đăng nhập vào hệ thống. Vì lý do bảo mật, bạn bắt buộc phải thay đổi mật khẩu mặc định trước khi sử dụng.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
            <label className="form-label">Mật khẩu hiện tại (mặc định/được cấp)</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showOldPass ? "text" : "password"}
                className="text-input"
                placeholder="Nhập mật khẩu cũ..."
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                disabled={submitting}
                required
                style={{ paddingRight: '38px' }}
              />
              <button
                type="button"
                onClick={() => setShowOldPass(!showOldPass)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-mute)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 0
                }}
              >
                {showOldPass ? <EyeSlash size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
            <label className="form-label">Mật khẩu mới</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showNewPass ? "text" : "password"}
                className="text-input"
                placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)..."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={submitting}
                required
                style={{ paddingRight: '38px' }}
              />
              <button
                type="button"
                onClick={() => setShowNewPass(!showNewPass)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-mute)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 0
                }}
              >
                {showNewPass ? <EyeSlash size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
            <label className="form-label">Xác nhận mật khẩu mới</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirmPass ? "text" : "password"}
                className="text-input"
                placeholder="Nhập lại mật khẩu mới..."
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={submitting}
                required
                style={{ paddingRight: '38px' }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPass(!showConfirmPass)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-mute)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 0
                }}
              >
                {showConfirmPass ? <EyeSlash size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button type="submit" className="btn-primary" disabled={submitting} style={{ height: '40px', justifyContent: 'center' }}>
              <FloppyDisk size={18} weight="bold" style={{ marginRight: 8 }} />
              {submitting ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
            </button>
            
            <button type="button" className="btn-outline" onClick={logout} disabled={submitting} style={{ height: '40px', justifyContent: 'center', borderColor: 'var(--color-hairline)' }}>
              <SignOut size={18} weight="bold" style={{ marginRight: 8 }} />
              Đăng xuất
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
