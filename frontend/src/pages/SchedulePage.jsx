import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { CalendarDots, ArrowRight, Eye, PushPin } from '@phosphor-icons/react'

const getSessionColor = (session) => {
  const classCode = session.class_code || '';
  const role = session.assigned_role || '';
  const caps = session.teacher_capabilities || [];
  
  let minHue = 0;
  let maxHue = 360;
  
  if (role === 'foreign_teacher' || caps.includes('foreign_teacher')) {
    minHue = 100;
    maxHue = 160;
  } else if (role.startsWith('ta') || caps.some(c => c.startsWith('ta'))) {
    minHue = 300;
    maxHue = 350;
  } else if (role === 'lead_teacher' || caps.includes('lead_teacher')) {
    minHue = 200;
    maxHue = 260;
  } else {
    minHue = 180;
    maxHue = 220;
  }
  
  let hash = 0;
  for (let i = 0; i < classCode.length; i++) {
    hash = classCode.charCodeAt(i) + ((hash << 5) - hash);
  }
  const relativeVal = Math.abs(hash % 100) / 100.0;
  const h = Math.round(minHue + relativeVal * (maxHue - minHue));
  
  const isPinned = session.is_pinned;
  
  return {
    bg: `hsla(${h}, 85%, 95%, 1)`,
    border: isPinned ? `2px solid hsla(${h}, 80%, 40%, 1)` : `1.5px solid hsla(${h}, 70%, 55%, 0.7)`,
    text: `hsla(${h}, 90%, 20%, 1)`
  };
};

export default function SchedulePage() {
  const [weeks, setWeeks] = useState([])
  const [selectedWeekId, setSelectedWeekId] = useState(null)
  const [sessions, setSessions] = useState([])
  const [rooms, setRooms] = useState([])
  const [timeSlots, setTimeSlots] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    api.getWeeks().then(w => {
      setWeeks(w)
      // Auto-select latest reviewed/published week, or most recent
      const best = w.find(x => x.status === 'published') || w.find(x => x.status === 'review') || w[0]
      if (best) setSelectedWeekId(best.id)
    }).catch(console.error)

    Promise.all([api.getRooms(), api.getTimeSlots()]).then(([r, ts]) => {
      setRooms(r)
      setTimeSlots(ts)
    }).catch(console.error)
  }, [])

  useEffect(() => {
    if (selectedWeekId) {
      api.getSessions(selectedWeekId).then(setSessions).catch(console.error)
    }
  }, [selectedWeekId])

  const days = [2, 3, 4, 5, 6, 7, 8]
  const dayNames = { 2: 'Thứ 2', 3: 'Thứ 3', 4: 'Thứ 4', 5: 'Thứ 5', 6: 'Thứ 6', 7: 'Thứ 7', 8: 'CN' }

  const selectedWeek = weeks.find(w => w.id === selectedWeekId)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Thời Khóa Biểu</h1>
          <p className="page-subtitle">Xem nhanh TKB theo tuần</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
          <select
            className="select-input"
            value={selectedWeekId || ''}
            onChange={e => setSelectedWeekId(e.target.value)}
            style={{ minWidth: 220 }}
          >
            {weeks.map(w => (
              <option key={w.id} value={w.id}>
                Tuần {new Date(w.week_start).toLocaleDateString('vi-VN')} — {w.status}
              </option>
            ))}
          </select>
          {selectedWeekId && (
            <button className="btn-primary btn-sm" onClick={() => navigate(`/weeks/${selectedWeekId}`)}>
              <Eye size={16} weight="bold" style={{ marginRight: 6 }} /> Chi tiết
            </button>
          )}
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="empty-state">
          <CalendarDots size={64} weight="light" />
          <p>{selectedWeek ? 'Tuần này chưa có lịch. Hãy vào chi tiết tuần và chạy Solver.' : 'Chưa có tuần nào được tạo.'}</p>
        </div>
      ) : (
        <div style={{ maxHeight: 'calc(100vh - 200px)', overflow: 'auto', border: '1px solid var(--color-hairline)', borderRadius: 'var(--radius-sm)' }}>
          <table className="data-table" style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', tableLayout: 'fixed', minWidth: '900px', border: 'none', overflow: 'visible' }}>
            <thead>
              <tr style={{ position: 'sticky', top: 0, zIndex: 12 }}>
                <th style={{ width: '120px', background: 'var(--color-surface-soft)', borderRight: '1px solid var(--color-hairline)', borderBottom: '2px solid var(--color-primary)', height: '37px', boxSizing: 'border-box', padding: '0 8px' }}>Thời gian</th>
                {rooms.map(r => (
                  <th key={r.id} style={{ textAlign: 'center', background: 'var(--color-surface-soft)', borderBottom: '2px solid var(--color-primary)', height: '37px', boxSizing: 'border-box', padding: '0 8px' }}>
                    {r.name}
                  </th>
                ))}
              </tr>
            </thead>
            {days.map(day => {
              const daySlots = timeSlots.filter(ts => ts.day_of_week === day).sort((a, b) => a.start_time.localeCompare(b.start_time))
              if (daySlots.length === 0) return null
              return (
                <tbody key={day}>
                  <tr>
                    <td 
                      colSpan={rooms.length + 1} 
                      style={{ 
                        position: 'sticky',
                        top: '37px',
                        zIndex: 10,
                        background: 'var(--color-surface)', 
                        fontWeight: 700, 
                        padding: '6px var(--space-md)', 
                        color: 'var(--color-primary)', 
                        fontSize: 'var(--text-body-sm-size)', 
                        borderTop: '1px solid var(--color-hairline)', 
                        borderBottom: '1px solid var(--color-hairline)' 
                      }}
                    >
                      {dayNames[day]}
                    </td>
                  </tr>
                  {daySlots.map(ts => (
                    <tr key={ts.id}>
                      <td style={{ fontWeight: 600, fontSize: '11px', borderRight: '1px solid var(--color-hairline)', borderBottom: '1px solid var(--color-hairline)', textAlign: 'center', color: 'var(--color-mute)' }}>
                        {ts.start_time.slice(0, 5)}<br />{ts.end_time.slice(0, 5)}
                      </td>
                      {rooms.map(r => {
                        const s = sessions.find(sess => sess.time_slot_id === ts.id && sess.room_id === r.id)
                        
                        let isConnectedTop = false;
                        let isConnectedBottom = false;
                        let hideTeacherName = false;
                        
                        if (s) {
                          const prevTs = daySlots[daySlots.indexOf(ts) - 1];
                          const nextTs = daySlots[daySlots.indexOf(ts) + 1];
                          
                          if (prevTs) {
                            const prevS = sessions.find(x => 
                              x.time_slot_id === prevTs.id && 
                              x.room_id === r.id
                            );
                            if (prevS && prevS.class_id === s.class_id) {
                              isConnectedTop = true;
                              if (prevS.teacher_name === s.teacher_name &&
                                  prevS.ta_name === s.ta_name &&
                                  prevS.assigned_role === s.assigned_role &&
                                  prevS.assigned_ta_role === s.assigned_ta_role) {
                                hideTeacherName = true;
                              }
                            }
                          }
                          
                          if (nextTs) {
                            isConnectedBottom = sessions.some(x => 
                              x.time_slot_id === nextTs.id && 
                              x.room_id === r.id && 
                              x.class_id === s.class_id
                            );
                          }
                        }

                        const borderBottom = isConnectedBottom ? 'none' : '1px solid var(--color-hairline)';
                        const paddingTop = isConnectedTop ? '0' : '4px';
                        const paddingBottom = isConnectedBottom ? '0' : '4px';
                        const borderRadius = `${isConnectedTop ? '0' : 'var(--radius-sm)'} ${isConnectedTop ? '0' : 'var(--radius-sm)'} ${isConnectedBottom ? '0' : 'var(--radius-sm)'} ${isConnectedBottom ? '0' : 'var(--radius-sm)'}`;

                        return (
                          <td key={r.id} style={{ 
                            borderRight: '1px solid var(--color-hairline)', 
                            borderBottom, 
                            paddingTop, 
                            paddingBottom, 
                            paddingLeft: '4px',
                            paddingRight: '4px',
                            verticalAlign: 'top', 
                            height: '56px' 
                          }}>
                            {s && (() => {
                              const colors = getSessionColor(s);
                              const role = s.assigned_role || '';
                              return (
                                <div style={{
                                  background: colors.bg,
                                  borderTop: isConnectedTop ? 'none' : colors.border,
                                  borderBottom: isConnectedBottom ? 'none' : colors.border,
                                  borderLeft: colors.border,
                                  borderRight: colors.border,
                                  color: colors.text,
                                  borderRadius, padding: '4px 6px', height: '100%',
                                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                                }}>
                                  {(!isConnectedTop) && (
                                    <div style={{ fontWeight: 700, fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span>{s.class_code}</span>
                                      {s.is_pinned && <PushPin size={10} color="var(--color-accent)" weight="fill" />}
                                    </div>
                                  )}
                                  {(!hideTeacherName) && (
                                    <div style={{ fontSize: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.9, marginTop: isConnectedTop ? 'auto' : '0' }}>
                                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>{s.teacher_name || ''}</span>
                                      {role && role !== 'lead_teacher' && (
                                        <span style={{ fontSize: '7.5px', padding: '1px 3px', borderRadius: '2px', background: 'rgba(0,0,0,0.06)', fontWeight: 700 }}>
                                          {role === 'foreign_teacher' ? 'For' :
                                           role === 'ta_solo' ? 'TA Solo' :
                                           role === 'ta_support' ? 'TA Support' :
                                           role === 'ta_ielts' ? 'TA IELTS' :
                                           role === 'ta_kids' ? 'TA Kids' : role}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              )
            })}
          </table>
        </div>
      )}
    </div>
  )
}
