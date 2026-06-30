import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { EnvelopeSimple, CircleNotch, Warning, CheckCircle, ArrowLeft } from '@phosphor-icons/react';
import '../styles/auth.css';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Vui lòng nhập địa chỉ email của bạn.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const res = await api.forgotPassword(email);
      setSuccess(res.message || 'Đường dẫn đặt lại mật khẩu đã được gửi đến email của bạn.');
      setEmail('');
    } catch (err) {
      if (err.response?.error === 'RateLimitExceeded') {
        setError('Bạn đã gửi yêu cầu quá nhiều lần. Vui lòng thử lại sau 15 phút.');
      } else {
        setError(err.message || 'Có lỗi xảy ra, vui lòng thử lại.');
      }
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
        <p className="auth-subtitle">Khôi phục mật khẩu tài khoản</p>

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
              <label className="auth-label">Địa chỉ email đã đăng ký</label>
              <div className="auth-input-wrapper">
                <input
                  type="email"
                  className="auth-input"
                  placeholder="Nhập địa chỉ email..."
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                />
                <div className="auth-icon-left">
                  <EnvelopeSimple size={18} />
                </div>
              </div>
            </div>

            <button type="submit" className="auth-btn" disabled={submitting}>
              {submitting ? (
                <>
                  <CircleNotch size={18} className="spin-animation" />
                  Đang gửi yêu cầu...
                </>
              ) : (
                'Gửi link khôi phục'
              )}
            </button>
          </form>
        ) : (
          <div style={{ textAlign: 'center', margin: 'var(--space-lg) 0' }}>
            <p style={{ color: 'var(--color-on-dark-mute)', fontSize: 'var(--text-body-sm-size)', marginBottom: 'var(--space-md)' }}>
              Vui lòng kiểm tra hộp thư đến (bao gồm cả thư mục Spam/Quảng cáo) để thực hiện đặt lại mật khẩu theo hướng dẫn.
            </p>
          </div>
        )}

        <div className="auth-footer" style={{ marginTop: 'var(--space-xl)', textAlign: 'center' }}>
          <Link to="/login" className="auth-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
            <ArrowLeft size={16} />
            Quay lại trang đăng nhập
          </Link>
        </div>
      </div>
    </div>
  );
}
