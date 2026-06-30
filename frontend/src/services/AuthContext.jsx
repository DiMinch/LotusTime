import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, setAccessToken } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. Silent Refresh on App Mount
  useEffect(() => {
    async function checkSession() {
      try {
        const data = await api.refresh();
        if (data.accessToken) {
          setAccessToken(data.accessToken);
          setUser(data.user);
        }
      } catch (err) {
        console.log('No active session found.');
      } finally {
        setLoading(false);
      }
    }
    checkSession();
  }, []);

  // 2. Listen to custom logout events triggered by API interceptor
  useEffect(() => {
    const handleLogout = (e) => {
      setAccessToken(null);
      setUser(null);
      if (e.detail?.reason === 'session_expired') {
        alert('Phiên làm việc của bạn đã hết hạn. Vui lòng đăng nhập lại.');
      } else if (e.detail?.reason === 'security_revocation') {
        alert('Cảnh báo bảo mật: Phiên làm việc đã được sử dụng ở nơi khác. Tất cả các thiết bị đã bị đăng xuất.');
      }
    };

    window.addEventListener('auth-logout', handleLogout);
    return () => window.removeEventListener('auth-logout', handleLogout);
  }, []);

  const login = async (username, password, rememberMe) => {
    try {
      const data = await api.login(username, password, rememberMe);
      setAccessToken(data.accessToken);
      setUser(data.user);
      return data.user;
    } catch (err) {
      throw err;
    }
  };

  const googleLogin = async (credential) => {
    try {
      const data = await api.googleLogin(credential);
      setAccessToken(data.accessToken);
      setUser(data.user);
      return data.user;
    } catch (err) {
      throw err;
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (err) {
      console.error('Logout API failed', err);
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  };

  const linkGoogle = async (credential) => {
    try {
      await api.googleLink(credential);
      // Fetch updated profile details
      const profile = await api.getProfile();
      setUser(prev => ({
        ...prev,
        google_id: profile.google_id
      }));
    } catch (err) {
      throw err;
    }
  };

  const updateFirstLoginFlag = (isFirstLogin) => {
    setUser(prev => prev ? { ...prev, is_first_login: isFirstLogin } : null);
  };

  const value = {
    user,
    loading,
    login,
    googleLogin,
    logout,
    linkGoogle,
    updateFirstLoginFlag,
    isAdmin: user?.role === 'admin'
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#16171d', color: '#fff' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              width: '48px', 
              height: '48px', 
              border: '4px solid var(--color-primary, #76b900)', 
              borderTopColor: 'transparent', 
              borderRadius: '50%', 
              margin: '0 auto 16px auto',
              animation: 'spin 1s linear infinite'
            }} />
            <p style={{ fontFamily: 'var(--font-sans, sans-serif)', fontSize: '16px' }}>Đang tải phiên làm việc...</p>
          </div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      ) : children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
