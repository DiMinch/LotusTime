import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { ArrowLeft, Clock, PushPin, Warning, CheckCircle } from '@phosphor-icons/react'
import { useToast } from '../components/layout/Toast'
import AvailabilityTab from './WeekTabs/AvailabilityTab'
import ConstraintsTab from './WeekTabs/ConstraintsTab'
import PinsTab from './WeekTabs/PinsTab'
import ScheduleGridTab from './WeekTabs/ScheduleGridTab'

const TABS = [
  { id: 'availability', label: 'Availability', icon: Clock },
  { id: 'constraints', label: 'Ràng buộc', icon: Warning },
  { id: 'pins', label: 'Gán cứng (Pins)', icon: PushPin },
  { id: 'grid', label: 'Kết quả TKB', icon: Clock },
]

export default function WeekDetailsPage() {
  const toast = useToast()
  const { id } = useParams()
  const navigate = useNavigate()
  const [week, setWeek] = useState(null)
  const [activeTab, setActiveTab] = useState('availability')
  const [solving, setSolving] = useState(false)

  const load = () => api.getWeek(id).then(setWeek).catch(console.error)

  useEffect(() => { load() }, [id])

  const handleSolve = async () => {
    setSolving(true)
    try {
      const res = await fetch(`/api/weeks/${id}/solve`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Lỗi xếp lịch')
      toast.success(`Đã xếp lịch thành công! Số lớp xếp được: ${data.solved_count}`)
      load()
      setActiveTab('grid')
    } catch (err) {
      toast.error('Lỗi: ' + err.message)
    } finally {
      setSolving(false)
    }
  }

  const handleUpdateStatus = async (newStatus) => {
    try {
      const updated = await api.updateWeekStatus(id, newStatus)
      setWeek(updated)
      toast.success(newStatus === 'published' ? 'Đã xuất bản thời khóa biểu thành công!' : 'Đã cập nhật trạng thái.')
    } catch (err) {
      toast.error('Lỗi: ' + err.message)
    }
  }

  if (!week) return <div>Đang tải...</div>

  return (
    <div>
      <div className="page-header" style={{ alignItems: 'flex-start' }}>
        <div>
          <button 
            className="btn-icon" 
            style={{ marginBottom: 'var(--space-md)', width: 'auto', padding: '0 var(--space-xs)' }}
            onClick={() => navigate('/weeks')}
          >
            <ArrowLeft size={20} style={{ marginRight: 'var(--space-xs)' }} /> Trở về danh sách
          </button>
          <h1 className="page-title">
            Tuần {new Date(week.week_start).toLocaleDateString('vi-VN')}
          </h1>
          <p className="page-subtitle" style={{ display: 'flex', alignItems: 'center' }}>
            Trạng thái: 
            <span className={`chip ${week.status === 'published' ? 'chip-green' : week.status === 'review' ? 'chip-pink' : 'chip-gray'}`} style={{ marginLeft: 'var(--space-xs)' }}>
              {week.status === 'published' ? 'Đã xuất bản' : week.status === 'review' ? 'Chờ duyệt (Review)' : week.status}
            </span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          {week.status !== 'published' && (
            <button className="btn-outline" onClick={handleSolve} disabled={solving}>
              {solving ? 'Đang xếp...' : 'Chạy Solver'}
            </button>
          )}
          
          {week.status === 'draft' && (
            <button className="btn-outline" onClick={() => handleUpdateStatus('review')}>
              Gửi Review
            </button>
          )}

          {week.status !== 'published' ? (
            <button className="btn-primary" onClick={() => handleUpdateStatus('published')}>
              <CheckCircle size={18} weight="bold" style={{ marginRight: 8 }} /> Xuất bản
            </button>
          ) : (
            <button className="btn-outline" style={{ borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }} onClick={() => handleUpdateStatus('review')}>
              Thu hồi xuất bản (Draft/Review)
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-lg)', borderBottom: '1px solid var(--color-hairline)', marginBottom: 'var(--space-xl)' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: 'var(--space-md) var(--space-sm)',
              borderBottom: activeTab === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--color-ink)' : 'var(--color-mute)',
              fontWeight: activeTab === tab.id ? 700 : 400,
              display: 'flex', alignItems: 'center', gap: 'var(--space-xs)',
              fontSize: 'var(--text-body-md-size)'
            }}
          >
            <tab.icon size={20} weight={activeTab === tab.id ? "fill" : "light"} />
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'availability' && <AvailabilityTab weekId={id} />}
        {activeTab === 'constraints' && <ConstraintsTab weekId={id} />}
        {activeTab === 'pins' && <PinsTab weekId={id} />}
        {activeTab === 'grid' && <ScheduleGridTab weekId={id} />}
      </div>
    </div>
  )
}
