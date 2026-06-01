import { useState } from 'react'
import { GearSix, FloppyDisk, Check } from '@phosphor-icons/react'
import { useToast } from '../components/layout/Toast'

export default function SettingsPage() {
  const toast = useToast()
  const [saved, setSaved] = useState(false)
  const [settings, setSettings] = useState(() => {
    const savedSettings = localStorage.getItem('lotustime_settings')
    if (savedSettings) {
      try {
        return JSON.parse(savedSettings)
      } catch (e) {
        console.error("Failed to parse settings", e)
      }
    }
    return {
      center_name: 'Anh ngữ Lotus',
      solver_timeout: 60,
      default_duration: 90,
      gemini_key: '',
    }
  })

  const handleSave = () => {
    localStorage.setItem('lotustime_settings', JSON.stringify(settings))
    toast.success('Đã lưu cấu hình hệ thống!')
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cài Đặt</h1>
          <p className="page-subtitle">Cấu hình hệ thống LotusTime</p>
        </div>
      </div>

      <div style={{ maxWidth: '600px' }}>
        <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
          <h2 style={{ fontSize: 'var(--text-heading-sm-size)', marginBottom: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <GearSix size={24} weight="light" /> Thông tin Trung tâm
          </h2>
          <div className="form-group">
            <label className="form-label">Tên trung tâm</label>
            <input className="text-input" value={settings.center_name}
              onChange={e => setSettings(s => ({ ...s, center_name: e.target.value }))} />
          </div>
        </div>

        <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
          <h2 style={{ fontSize: 'var(--text-heading-sm-size)', marginBottom: 'var(--space-lg)' }}>
            Solver & AI
          </h2>
          <div className="form-group">
            <label className="form-label">Thời gian chạy Solver tối đa (giây)</label>
            <input className="text-input" type="number" value={settings.solver_timeout}
              onChange={e => setSettings(s => ({ ...s, solver_timeout: parseInt(e.target.value) || 60 }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Thời lượng buổi học mặc định (phút)</label>
            <input className="text-input" type="number" value={settings.default_duration}
              onChange={e => setSettings(s => ({ ...s, default_duration: parseInt(e.target.value) || 90 }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Gemini API Key</label>
            <input className="text-input" type="password" placeholder="AIza..."
              value={settings.gemini_key}
              onChange={e => setSettings(s => ({ ...s, gemini_key: e.target.value }))} />
            <p style={{ fontSize: 'var(--text-caption-sm-size)', color: 'var(--color-mute)', marginTop: 4 }}>
              Key này được lưu ở localStorage trình duyệt. Sử dụng cho tính năng phân tích ràng buộc NLP.
            </p>
          </div>
        </div>

        <button className="btn-primary" onClick={handleSave}>
          {saved
            ? <><Check size={18} weight="bold" style={{ marginRight: 8 }} />Đã lưu</>
            : <><FloppyDisk size={18} weight="bold" style={{ marginRight: 8 }} />Lưu cài đặt</>
          }
        </button>
      </div>
    </div>
  )
}
