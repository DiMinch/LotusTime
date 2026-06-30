import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { LockKey, CircleNotch, Warning, CheckCircle, Eye, EyeSlash } from '@phosphor-icons/react';
import '../styles/auth.css';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      setError('Mã xác nhận khôi phục mật khẩu không hợp lệ.');
      return;
    }

    if (!password || !confirmPassword) {
      setError('Vui lòng nhập đầy đủ mật khẩu mới và xác nhận mật khẩu.');
      return;
    }

    if (password.length < 6) {
      setError('Mật khẩu mới phải chứa ít nhất 6 ký tự.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Mật khẩu nhập lại không khớp.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const res = await api.resetPassword(token, password);
      setSuccess(res.message || 'Mật khẩu của bạn đã được cập nhật thành công.');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message || 'Thiết lập mật khẩu thất bại. Có thể liên kết khôi phục đã hết hạn.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">
          Lotus<span>Time</span>
        </div>
        <p className="auth-subtitle">Thiết lập mật khẩu mới</p>

        {!token ? (
          <div className="auth-error-alert">
            <Warning size={20} weight="fill" style={{ flexShrink: 0 }} />
            <span>Đường dẫn khôi phục mật khẩu không hợp lệ (thiếu token xác thực). Vui lòng kiểm tra lại email.</span>
          </div>
        ) : (
          <>
            {error && (
              <div className="auth-error-alert">
                <Warning size={20} weight="fill" style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="auth-success-alert">
                <CheckCircle size={20} weight="fill" style={{ flexShrink: 0 }} />
                <span>{success}</span>
              </div>
            )}

            {!success ? (
              <form onSubmit={handleSubmit}>
                 <div className="auth-group">
                  <label className="auth-label">Mật khẩu mới</label>
                  <div className="auth-input-wrapper">
                    <input
                      type={showPass ? "text" : "password"}
                      className="auth-input"
                      placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)..."
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={submitting}
                      style={{ paddingRight: '38px' }}
                    />
                    <div className="auth-icon-left">
                      <LockKey size={18} />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-on-dark-mute)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        padding: 0
                      }}
                    >
                      {showPass ? <EyeSlash size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="auth-group">
                  <label className="auth-label">Xác nhận mật khẩu mới</label>
                  <div className="auth-input-wrapper">
                    <input
                      type={showConfirmPass ? "text" : "password"}
                      className="auth-input"
                      placeholder="Nhập lại mật khẩu mới..."
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={submitting}
                      style={{ paddingRight: '38px' }}
                    />
                    <div className="auth-icon-left">
                      <LockKey size={18} />
                    </div>
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
                        color: 'var(--color-on-dark-mute)',
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

                <button type="submit" className="auth-btn" disabled={submitting}>
                  {submitting ? (
                    <>
                      <CircleNotch size={18} className="spin-animation" />
                      Đang cập nhật mật khẩu...
                    </>
                  ) : (
                    'Cập nhật mật khẩu'
                  )}
                </button>
              </form>
            ) : (
              <div style={{ textAlign: 'center', margin: 'var(--space-lg) 0' }}>
                <Link to="/login" className="auth-btn" style={{ textDecoration: 'none' }}>
                  Đăng nhập ngay
                </Link>
              </div>
            )}
          </>
        )}

        {(!success || !token) && (
          <div className="auth-footer" style={{ textAlign: 'center' }}>
            <Link to="/login" className="auth-link">
              Quay lại đăng nhập
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
