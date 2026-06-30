import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom'
import Layout from './components/layout/Layout'
import DashboardPage from './pages/DashboardPage'
import PersonsPage from './pages/PersonsPage'
import RoomsPage from './pages/RoomsPage'
import ClassesPage from './pages/ClassesPage'
import TimeSlotsPage from './pages/TimeSlotsPage'
import WeeksPage from './pages/WeeksPage'
import WeekDetailsPage from './pages/WeekDetailsPage'
import SchedulePage from './pages/SchedulePage'
import SettingsPage from './pages/SettingsPage'
import LoginPage from './pages/LoginPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import ProfilePage from './pages/ProfilePage'
import AttendancePage from './pages/AttendancePage'
import AdminAttendancePage from './pages/AdminAttendancePage'
import { ToastProvider } from './components/layout/Toast'
import { ConfirmProvider } from './components/layout/ConfirmModal'
import { AuthProvider } from './services/AuthContext'
import { ProtectedRoute, AdminRoute } from './components/layout/RouteGuards'

function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              {/* Public Routes - No Layout/Sidebar */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              {/* Protected Routes (Requires Authentication) */}
              <Route element={<ProtectedRoute />}>
                <Route element={<Layout><Outlet /></Layout>}>
                  
                  {/* Both Admin and Staff can see Profile and Attendance */}
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/attendance" element={<AttendancePage />} />

                  {/* Admin Only Routes */}
                  <Route element={<AdminRoute />}>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/persons" element={<PersonsPage />} />
                    <Route path="/rooms" element={<RoomsPage />} />
                    <Route path="/classes" element={<ClassesPage />} />
                    <Route path="/time-slots" element={<TimeSlotsPage />} />
                    <Route path="/weeks" element={<WeeksPage />} />
                    <Route path="/weeks/:id" element={<WeekDetailsPage />} />
                    <Route path="/schedule" element={<SchedulePage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/admin/attendance" element={<AdminAttendancePage />} />
                  </Route>

                </Route>
              </Route>
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ConfirmProvider>
    </ToastProvider>
  )
}

export default App
