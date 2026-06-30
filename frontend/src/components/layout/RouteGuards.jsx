import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../services/AuthContext';
import { CircleNotch } from '@phosphor-icons/react';
import FirstLoginModal from './FirstLoginModal';

export function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#16171d', color: '#fff' }}>
        <div style={{ textAlign: 'center' }}>
          <CircleNotch size={48} className="spin-animation" style={{ color: 'var(--color-primary)', marginBottom: 'var(--space-md)' }} />
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: '16px' }}>Đang tải phiên làm việc...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.is_first_login) {
    return <FirstLoginModal />;
  }

  return <Outlet />;
}

export function AdminRoute() {
  const { user, isAdmin } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    // Staff are only allowed to see Profile page (and logout)
    return <Navigate to="/profile" replace />;
  }

  return <Outlet />;
}
