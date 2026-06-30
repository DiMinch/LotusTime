import React, { useState, useEffect } from 'react';
import { useAuth } from '../services/AuthContext';
import { api } from '../services/api';
import { useToast } from '../components/layout/Toast';
import { User, Lock, FloppyDisk, Check, GoogleLogo, Eye, EyeSlash } from '@phosphor-icons/react';

export default function ProfilePage() {
  const { user, linkGoogle } = useAuth();
  const toast = useToast();

  const [profileData, setProfileData] = useState(user);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [submittingPass, setSubmittingPass] = useState(false);
  const [linkingGoogle, setLinkingGoogle] = useState(false);

  // 1. Fetch full user profile details on mount
  const loadProfile = async () => {
    try {
      const data = await api.getProfile();
      setProfileData(data);
    } catch (err) {
      console.error('Failed to fetch profile', err);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  // 2. Google Link Button Rendering with polling to prevent async script load race conditions
  useEffect(() => {
    let isMounted = true;
    let timer;

    if (profileData && !profileData.google_id) {
      async function initGoogleLink() {
        try {
          const config = await api.getConfig();
          if (!config.googleClientId) return;

          // Poll every 100ms until window.google is loaded by index.html
          timer = setInterval(() => {
            if (window.google) {
              clearInterval(timer);
              if (isMounted) {
                window.google.accounts.id.initialize({
                  client_id: config.googleClientId,
                  callback: handleGoogleLinkResponse
                });
                const container = document.getElementById('google-link-btn');
                if (container) {
                  window.google.accounts.id.renderButton(
                    container,
                    { theme: 'outline', size: 'large', text: 'signup_with', shape: 'rectangular' }
                  );
                }
              }
            }
          }, 100);
        } catch (err) {
          console.error('Failed to init Google link config', err);
        }
      }
      initGoogleLink();
    }

    return () => {
      isMounted = false;
      if (timer) clearInterval(timer);
    };
  }, [profileData?.google_id]);

  const handleGoogleLinkResponse = async (response) => {
    setLinkingGoogle(true);
    try {
      await linkGoogle(response.credential);
      toast.success('Liên kết tài khoản Google thành công!');
      await loadProfile(); // Refresh profile state to show success badge
    } catch (err) {
      toast.error(err.message || 'Liên kết tài khoản Google thất bại.');
    } finally {
      setLinkingGoogle(false);
    }
  };

  // 3. Submit Change Password
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error('Vui lòng điền đầy đủ thông tin thay đổi mật khẩu.');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Mật khẩu mới phải chứa ít nhất 6 ký tự.');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu nhập lại không khớp.');
      return;
    }

    setSubmittingPass(true);
    try {
      await api.changePassword(oldPassword, newPassword);
      toast.success('Thay đổi mật khẩu thành công!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      if (err.response?.error === 'InvalidOldPassword') {
        toast.error('Mật khẩu cũ không chính xác.');
      } else {
        toast.error(err.message || 'Thay đổi mật khẩu thất bại.');
      }
    } finally {
      setSubmittingPass(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Hồ Sơ Cá Nhân</h1>
          <p className="page-subtitle">Quản lý tài khoản của bạn</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-xl)' }}>
        
        {/* Account Info Card */}
        <div>
          <div className="card" style={{ height: '100%' }}>
            <h2 style={{ fontSize: 'var(--text-heading-sm-size)', marginBottom: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <User size={24} weight="light" /> Thông tin tài khoản
            </h2>

            <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
              <label className="form-label" style={{ fontWeight: 'bold' }}>Tên đăng nhập</label>
              <div style={{ padding: '8px 0', borderBottom: '1px solid var(--color-hairline)', color: 'var(--text-h)' }}>
                {profileData?.username}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
              <label className="form-label" style={{ fontWeight: 'bold' }}>Địa chỉ Email</label>
              <div style={{ padding: '8px 0', borderBottom: '1px solid var(--color-hairline)', color: 'var(--text-h)' }}>
                {profileData?.email}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
              <label className="form-label" style={{ fontWeight: 'bold' }}>Vai trò hệ thống</label>
              <div style={{ padding: '8px 0', borderBottom: '1px solid var(--color-hairline)' }}>
                <span className={`chip ${profileData?.role === 'admin' ? 'chip-green' : 'chip-gray'}`} style={{ margin: 0 }}>
                  {profileData?.role === 'admin' ? 'Quản trị viên (Admin)' : 'Nhân viên trung tâm'}
                </span>
              </div>
            </div>

            {profileData?.person_short_name && (
              <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
                <label className="form-label" style={{ fontWeight: 'bold' }}>Liên kết nhân sự</label>
                <div style={{ padding: '8px 0', borderBottom: '1px solid var(--color-hairline)', color: 'var(--text-h)' }}>
                  {profileData.person_full_name} ({profileData.person_short_name})
                </div>
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
              <label className="form-label" style={{ fontWeight: 'bold' }}>Ngày tạo</label>
              <div style={{ padding: '8px 0', borderBottom: '1px solid var(--color-hairline)', color: 'var(--text-h)' }}>
                {formatDate(profileData?.created_at)}
              </div>
            </div>

            {/* Google OAuth Section */}
            <div style={{ marginTop: 'var(--space-xl)', padding: 'var(--space-md)', background: 'var(--color-surface-soft)', borderRadius: '4px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 10px 0', color: 'var(--text-h)' }}>
                <GoogleLogo size={20} weight="fill" style={{ color: '#4285F4' }} /> Liên kết Google Login
              </h3>
              {profileData?.google_id ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-success-deep)', fontWeight: 'bold', fontSize: '14px' }}>
                  <Check size={18} weight="bold" /> Đã liên kết tài khoản Google thành công. Bạn có thể sử dụng Google Đăng nhập trực tiếp.
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: '13px', color: 'var(--color-mute)', marginBottom: '12px' }}>
                    Cho phép bạn đăng nhập nhanh vào hệ thống bằng tài khoản Google mà không cần mật khẩu (yêu cầu trùng khớp địa chỉ Email).
                  </p>
                  <div id="google-link-btn" style={{ minHeight: '40px' }}></div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Change Password Card */}
        <div>
          <form className="card" onSubmit={handlePasswordSubmit}>
            <h2 style={{ fontSize: 'var(--text-heading-sm-size)', marginBottom: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lock size={24} weight="light" /> Đổi mật khẩu
            </h2>

            <div className="form-group">
              <label className="form-label">Mật khẩu hiện tại</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showOldPass ? "text" : "password"}
                  className="text-input"
                  placeholder="Nhập mật khẩu hiện tại..."
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  disabled={submittingPass}
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

            <div className="form-group">
              <label className="form-label">Mật khẩu mới</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNewPass ? "text" : "password"}
                  className="text-input"
                  placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={submittingPass}
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

            <div className="form-group">
              <label className="form-label">Xác nhận mật khẩu mới</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirmPass ? "text" : "password"}
                  className="text-input"
                  placeholder="Nhập lại mật khẩu mới..."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={submittingPass}
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

            <button type="submit" className="btn-primary" disabled={submittingPass} style={{ marginTop: 'var(--space-md)' }}>
              {submittingPass ? 'Đang cập nhật...' : (
                <>
                  <FloppyDisk size={18} weight="bold" style={{ marginRight: 8 }} />
                  Cập nhật mật khẩu
                </>
              )}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
