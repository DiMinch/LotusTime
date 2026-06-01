import { BrowserRouter, Routes, Route } from 'react-router-dom'
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
import { ToastProvider } from './components/layout/Toast'
import { ConfirmProvider } from './components/layout/ConfirmModal'

function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/persons" element={<PersonsPage />} />
            <Route path="/rooms" element={<RoomsPage />} />
            <Route path="/classes" element={<ClassesPage />} />
            <Route path="/time-slots" element={<TimeSlotsPage />} />
            <Route path="/weeks" element={<WeeksPage />} />
            <Route path="/weeks/:id" element={<WeekDetailsPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
      </ConfirmProvider>
    </ToastProvider>
  )
}

export default App
