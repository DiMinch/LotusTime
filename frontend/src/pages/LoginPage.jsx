import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../services/AuthContext';
import { api } from '../services/api';
import { User, LockKey, CircleNotch, Warning, Eye, EyeSlash } from '@phosphor-icons/react';
import '../styles/auth.css';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();

  // 1. Load Google Client ID and render Google Sign-In Button
  useEffect(() => {
    let isMounted = true;
    let timer;
    let resizeTimer;

    const renderButton = () => {
      const container = document.getElementById('google-signin-btn');
      if (container && window.google) {
        const parentWidth = container.offsetWidth || 386;
        const btnWidth = Math.min(Math.max(parentWidth, 200), 400);
        container.innerHTML = ''; // Clear previous button to re-render
        window.google.accounts.id.renderButton(
          container,
          { 
            theme: 'dark', 
            size: 'large', 
            type: 'standard', 
            text: 'signin_with', 
            shape: 'rectangular', 
            width: btnWidth 
          }
        );
      }
    };

    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (isMounted) renderButton();
      }, 250);
    };
    
    async function initGoogle() {
      try {
        const config = await api.getConfig();
        if (!config.googleClientId) return;

        timer = setInterval(() => {
          if (window.google) {
            clearInterval(timer);
            if (isMounted) {
              if (!window.googleInitialized) {
                window.google.accounts.id.initialize({
                  client_id: config.googleClientId,
                  callback: handleGoogleCredentialResponse
                });
                window.googleInitialized = true;
              }
              renderButton();
              window.addEventListener('resize', handleResize);
            }
          }
        }, 100);
      } catch (err) {
        console.error('Failed to load Google client ID config', err);
      }
    }
    
    initGoogle();
    return () => {
      isMounted = false;
      if (timer) clearInterval(timer);
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleGoogleCredentialResponse = async (response) => {
    setSubmitting(true);
    setError('');
    try {
      await googleLogin(response.credential);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Đăng nhập bằng tài khoản Google thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Submit Username/Password Form
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await login(username, password, rememberMe);
      navigate('/');
    } catch (err) {
      // Keep rate limiter messages user friendly
      if (err.response?.error === 'RateLimitExceeded') {
        setError('Bạn đã thử đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.');
      } else {
        setError(err.message || 'Tên đăng nhập hoặc mật khẩu không chính xác.');
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
        <p className="auth-subtitle">Hệ thống quản lý thời khóa biểu Lotus Center</p>

        {error && (
          <div className="auth-error-alert">
            <Warning size={20} weight="fill" style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="auth-group">
            <label className="auth-label">Tên đăng nhập / Email</label>
            <div className="auth-input-wrapper">
              <input
                type="text"
                className="auth-input"
                placeholder="Nhập tên đăng nhập hoặc email..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={submitting}
              />
              <div className="auth-icon-left">
                <User size={18} />
              </div>
            </div>
          </div>

          <div className="auth-group">
            <label className="auth-label">Mật khẩu</label>
            <div className="auth-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                className="auth-input"
                placeholder="Nhập mật khẩu..."
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
                onClick={() => setShowPassword(!showPassword)}
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
                {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="auth-options">
            <label className="auth-remember">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={submitting}
              />
              <span>Duy trì đăng nhập</span>
            </label>
            <Link to="/forgot-password" className="auth-link">
              Quên mật khẩu?
            </Link>
          </div>

          <button type="submit" className="auth-btn" disabled={submitting}>
            {submitting ? (
              <>
                <CircleNotch size={18} className="spin-animation" />
                Đang đăng nhập...
              </>
            ) : (
              'Đăng nhập'
            )}
          </button>
        </form>

        <div className="auth-divider">hoặc đăng nhập bằng</div>

        <div className="google-btn-container">
          <div id="google-signin-btn"></div>
        </div>
        
        <div style={{ fontSize: '12px', color: 'var(--color-on-dark-mute)', textAlign: 'center', marginTop: 'var(--space-md)' }}>
          * Đăng nhập Google yêu cầu bạn đã thực hiện liên kết tài khoản trước đó.
        </div>
      </div>
    </div>
  );
}
