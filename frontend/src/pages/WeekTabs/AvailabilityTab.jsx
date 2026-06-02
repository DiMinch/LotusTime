import { useState, useEffect } from 'react'
import { api } from '../../services/api'
import { Copy, FloppyDisk, Check, CheckSquare, Square } from '@phosphor-icons/react'
import { useToast } from '../../components/layout/Toast'

const DAYS = [
  { value: 2, label: 'Thứ 2' }, { value: 3, label: 'Thứ 3' },
  { value: 4, label: 'Thứ 4' }, { value: 5, label: 'Thứ 5' },
  { value: 6, label: 'Thứ 6' }, { value: 7, label: 'Thứ 7' },
  { value: 8, label: 'Chủ nhật' },
]
export default function AvailabilityTab({ weekId }) {
  const toast = useToast()
  const [persons, setPersons] = useState([])
  const [timeSlots, setTimeSlots] = useState([])
  const [availabilities, setAvailabilities] = useState([]) // Array of { person_id, time_slot_id }
  const [selectedPersonId, setSelectedPersonId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [previousWeekId, setPreviousWeekId] = useState(null)
  const [copying, setCopying] = useState(false)

  const loadData = () => {
    Promise.all([
      api.getPersons(),
      api.getTimeSlots(),
      api.getAvailability(weekId),
      api.getWeeks()
    ]).then(([p, t, a, weeks]) => {
      setPersons(p)
      setTimeSlots(t)
      setAvailabilities(a.map(x => ({ person_id: x.person_id, time_slot_id: x.time_slot_id })))
      if (p.length > 0) setSelectedPersonId(prev => prev || p[0].id)

      if (weeks && weeks.length > 0) {
        const sorted = [...weeks].sort((x, y) => new Date(x.week_start) - new Date(y.week_start))
        const currentIdx = sorted.findIndex(w => w.id === weekId)
        if (currentIdx > 0) {
          setPreviousWeekId(sorted[currentIdx - 1].id)
        }
      }
    }).catch(console.error)
  }

  useEffect(() => {
    loadData()
  }, [weekId])

  const toggleSlot = (slotId) => {
    if (!selectedPersonId) return
    const exists = availabilities.find(a => a.person_id === selectedPersonId && a.time_slot_id === slotId)
    if (exists) {
      setAvailabilities(availabilities.filter(a => !(a.person_id === selectedPersonId && a.time_slot_id === slotId)))
    } else {
      setAvailabilities([...availabilities, { person_id: selectedPersonId, time_slot_id: slotId }])
    }
  }

  const toggleAll = (check) => {
    if (!selectedPersonId) return
    if (check) {
      const newAvails = [...availabilities.filter(a => a.person_id !== selectedPersonId)]
      timeSlots.forEach(s => {
        newAvails.push({ person_id: selectedPersonId, time_slot_id: s.id })
      })
      setAvailabilities(newAvails)
    } else {
      setAvailabilities(availabilities.filter(a => a.person_id !== selectedPersonId))
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.saveAvailability(weekId, availabilities)
      toast.success('Đã lưu lịch rảnh thành công!')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error(err)
      toast.error('Lỗi khi lưu: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleCopyFromPrevious = async () => {
    if (!previousWeekId) {
      toast.error('Không tìm thấy tuần trước đó để copy!')
      return
    }
    setCopying(true)
    try {
      await api.copyAvailability(weekId, previousWeekId)
      toast.success('Đã copy thành công lịch rảnh từ tuần trước!')
      loadData()
    } catch (err) {
      toast.error('Lỗi khi copy: ' + err.message)
    } finally {
      setCopying(false)
    }
  }

  // Group slots by day
  const slotsByDay = DAYS.map(d => ({
    ...d,
    slots: timeSlots.filter(s => s.day_of_week === d.value)
  }))

  const selectedPerson = persons.find(p => p.id === selectedPersonId)
  const myAvails = availabilities.filter(a => a.person_id === selectedPersonId).map(a => a.time_slot_id)

  return (
    <div style={{ display: 'flex', gap: 'var(--space-xxl)', alignItems: 'flex-start' }}>
      
      {/* Left sidebar: Persons list */}
      <div className="card" style={{ width: '300px', flexShrink: 0, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: 'var(--space-md) var(--space-lg)', borderBottom: '1px solid var(--color-hairline)', background: 'var(--color-surface-soft)' }}>
          <h3 style={{ fontSize: 'var(--text-heading-sm-size)', margin: 0 }}>Giáo viên / TA</h3>
        </div>
        <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
          {persons.map(p => {
            const count = availabilities.filter(a => a.person_id === p.id).length
            const isSelected = p.id === selectedPersonId
            return (
              <button
                key={p.id}
                onClick={() => setSelectedPersonId(p.id)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  width: '100%', padding: 'var(--space-md) var(--space-lg)',
                  borderBottom: '1px solid var(--color-hairline)',
                  background: isSelected ? 'var(--color-surface-soft)' : 'transparent',
                  borderLeft: isSelected ? '3px solid var(--color-primary)' : '3px solid transparent',
                  textAlign: 'left'
                }}
              >
                <div>
                  <div style={{ fontWeight: isSelected ? 700 : 400 }}>{p.short_name}</div>
                  <div style={{ fontSize: 'var(--text-caption-sm-size)', color: 'var(--color-mute)' }}>{p.full_name}</div>
                </div>
                <span className="badge-tag" style={{ background: count > 0 ? 'rgba(118,185,0,0.1)' : 'var(--color-surface-soft)' }}>
                  {count} slots
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Right area: Grid */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xl)' }}>
          <div>
            <h2 style={{ fontSize: 'var(--text-heading-md-size)' }}>
              Lịch rảnh của {selectedPerson ? selectedPerson.short_name : '...'}
            </h2>
            {selectedPerson && (
              <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-sm)' }}>
                <button className="btn-outline btn-sm" onClick={() => toggleAll(true)}>
                  <CheckSquare size={16} style={{ marginRight: 6 }} /> Chọn tất cả
                </button>
                <button className="btn-outline btn-sm" onClick={() => toggleAll(false)}>
                  <Square size={16} style={{ marginRight: 6 }} /> Bỏ chọn tất cả
                </button>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <button className="btn-outline" onClick={handleCopyFromPrevious} disabled={copying || !previousWeekId}>
              <Copy size={18} style={{ marginRight: 8 }} />
              {copying ? 'Đang copy...' : 'Copy từ tuần trước'}
            </button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saved ? <Check size={18} weight="bold" style={{ marginRight: 8 }} /> : <FloppyDisk size={18} weight="bold" style={{ marginRight: 8 }} />}
              {saved ? 'Đã lưu' : 'Lưu Availability'}
            </button>
          </div>
        </div>

        {selectedPerson ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-xl)' }}>
            {slotsByDay.map(d => {
              if (d.slots.length === 0) return null
              return (
                <div key={d.value} className="card card-shell" style={{ padding: 'var(--space-sm)' }}>
                  <div className="card-core" style={{ padding: 'var(--space-md)' }}>
                    <h3 style={{ fontSize: 'var(--text-body-strong-size)', marginBottom: 'var(--space-md)', textAlign: 'center', borderBottom: '1px solid var(--color-hairline)', paddingBottom: 'var(--space-xs)' }}>
                      {d.label}
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
                      {d.slots.map(s => {
                        const isChecked = myAvails.includes(s.id)
                        return (
                          <label 
                            key={s.id} 
                            style={{ 
                              display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', 
                              padding: 'var(--space-xs)', borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer',
                              background: isChecked ? 'rgba(118, 185, 0, 0.05)' : 'transparent'
                            }}
                          >
                            <input 
                              type="checkbox" 
                              checked={isChecked}
                              onChange={() => toggleSlot(s.id)}
                              style={{ width: 16, height: 16, accentColor: 'var(--color-primary)' }}
                            />
                            <div>
                              <div style={{ fontSize: 'var(--text-body-sm-size)', fontWeight: isChecked ? 700 : 400 }}>{s.label}</div>
                              <div style={{ fontSize: 'var(--text-caption-sm-size)', color: 'var(--color-mute)' }}>
                                {s.start_time.slice(0,5)} - {s.end_time.slice(0,5)}
                              </div>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="empty-state">
            <p>Vui lòng chọn một giáo viên bên trái để xem và cập nhật lịch rảnh.</p>
          </div>
        )}
      </div>

    </div>
  )
}
