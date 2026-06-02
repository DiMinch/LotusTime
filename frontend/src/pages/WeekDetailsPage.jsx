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
  const [solvingStatus, setSolvingStatus] = useState("Đang chuẩn bị dữ liệu...")

  const load = () => api.getWeek(id).then(setWeek).catch(console.error)

  useEffect(() => { load() }, [id])

  useEffect(() => {
    if (!solving) return
    const statuses = [
      "Đang chuẩn bị dữ liệu...",
      "Đang phân tích các ràng buộc của giáo viên và phòng...",
      "Đang gán cứng các lớp được Pin...",
      "AI Solver đang tìm kiếm phương án tối ưu...",
      "Đang tối ưu hóa việc di chuyển phòng của giáo viên...",
      "Đang sắp xếp phân đoạn Trợ giảng và GV chính...",
      "Đang lưu kết quả thời khóa biểu mới..."
    ]
    let idx = 0
    setSolvingStatus(statuses[0])
    const interval = setInterval(() => {
      idx = (idx + 1) % statuses.length
      setSolvingStatus(statuses[idx])
    }, 2000)
    return () => clearInterval(interval)
  }, [solving])

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

      {solving && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @keyframes pulse {
              0%, 100% { transform: scale(1); opacity: 0.8; }
              50% { transform: scale(1.1); opacity: 1; }
            }
            @keyframes indeterminateProgress {
              0% { transform: translateX(-100%); width: 30%; }
              50% { width: 60%; }
              100% { transform: translateX(330%); width: 30%; }
            }
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes scaleIn {
              from { transform: scale(0.95); opacity: 0; }
              to { transform: scale(1); opacity: 1; }
            }
          `}</style>
          <div style={{
            background: 'var(--color-bg-card, #ffffff)',
            padding: 'var(--space-xl) var(--space-2xl)',
            borderRadius: 'var(--radius-lg, 12px)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(255, 255, 255, 0.1)',
            textAlign: 'center',
            maxWidth: '440px',
            width: '90%',
            color: 'var(--color-ink, #0f172a)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--space-md)',
            animation: 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}>
            <div style={{ position: 'relative', width: '80px', height: '80px', marginBottom: 'var(--space-sm)' }}>
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                borderRadius: '50%',
                border: '3px solid transparent',
                borderTopColor: 'var(--color-primary, #3b82f6)',
                borderBottomColor: 'var(--color-primary, #3b82f6)',
                animation: 'spin 1.5s linear infinite'
              }} />
              <div style={{
                position: 'absolute',
                top: '15px', left: '15px', right: '15px', bottom: '15px',
                borderRadius: '50%',
                background: 'rgba(59, 130, 246, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'pulse 1.5s ease-in-out infinite'
              }}>
                <Clock size={32} color="var(--color-primary, #3b82f6)" weight="duotone" />
              </div>
            </div>

            <h3 style={{ margin: 0, fontSize: 'var(--text-h3-size, 1.25rem)', fontWeight: 700 }}>
              AI Solver Đang Xếp Lịch...
            </h3>
            
            <p style={{ 
              margin: 0, 
              color: 'var(--color-mute, #64748b)', 
              fontSize: 'var(--text-body-sm-size, 0.875rem)',
              minHeight: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: '1.4'
            }}>
              {solvingStatus}
            </p>

            <div style={{ 
              width: '100%', 
              height: '6px', 
              background: 'rgba(59, 130, 246, 0.1)', 
              borderRadius: '3px',
              overflow: 'hidden',
              marginTop: 'var(--space-xs)'
            }}>
              <div style={{
                width: '60%',
                height: '100%',
                background: 'linear-gradient(90deg, var(--color-primary, #3b82f6), var(--color-accent, #6366f1))',
                borderRadius: '3px',
                animation: 'indeterminateProgress 2s infinite ease-in-out'
              }} />
            </div>
            
            <span style={{ fontSize: '11px', opacity: 0.6, marginTop: 'var(--space-xs)' }}>
              Vui lòng không đóng trình duyệt hoặc tải lại trang.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
