import React, { useState, useEffect, useCallback, useRef } from 'react'
import { DndContext, DragOverlay, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { api } from '../../services/api'
import { Books, PushPin, ArrowsOutCardinal, FileXls, FilePdf, PencilSimple, X, Download } from '@phosphor-icons/react'
import { useToast } from '../../components/layout/Toast'

/* ── getSessionColor Helper ────────────────────────────── */
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
    // Default to neutral blue/gray if no teacher assigned yet
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

/* ── mergeContiguousSessions Helper ────────────────────── */
const mergeContiguousSessions = (sList, timeSlots) => {
  if (!sList || sList.length === 0) return [];
  
  // 1. Map each session with its time slot details
  const mapped = sList.map(s => {
    const ts = timeSlots.find(slot => slot.id === s.time_slot_id) || {};
    return {
      ...s,
      day_of_week: ts.day_of_week,
      start_time: ts.start_time || '',
      end_time: ts.end_time || '',
    };
  });

  // 2. Sort by day of week, then start_time
  mapped.sort((a, b) => {
    if (a.day_of_week !== b.day_of_week) {
      return a.day_of_week - b.day_of_week;
    }
    return a.start_time.localeCompare(b.start_time);
  });

  // 3. Merge contiguous
  const merged = [];
  mapped.forEach(s => {
    if (merged.length === 0) {
      merged.push({
        id: s.id,
        sessionIds: [s.id],
        class_id: s.class_id,
        class_code: s.class_code,
        class_type: s.class_type,
        room_id: s.room_id,
        room_name: s.room_name,
        person_id: s.person_id,
        teacher_name: s.teacher_name,
        assigned_role: s.assigned_role,
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        slot_label: s.slot_label
      });
      return;
    }

    const last = merged[merged.length - 1];
    
    const isContiguous = 
      last.day_of_week === s.day_of_week &&
      last.room_id === s.room_id &&
      last.person_id === s.person_id &&
      last.end_time === s.start_time;

    if (isContiguous) {
      last.end_time = s.end_time;
      last.sessionIds.push(s.id);
    } else {
      merged.push({
        id: s.id,
        sessionIds: [s.id],
        class_id: s.class_id,
        class_code: s.class_code,
        class_type: s.class_type,
        room_id: s.room_id,
        room_name: s.room_name,
        person_id: s.person_id,
        teacher_name: s.teacher_name,
        assigned_role: s.assigned_role,
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        slot_label: s.slot_label
      });
    }
  });

  return merged;
};

/* ── Searchable Select Component ──────────────────────── */
function SearchableSelect({ options, value, onChange, placeholder, emptyLabel = "— Trống —" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);
  
  useEffect(() => {
    if (isOpen) {
      setSearch('');
    }
  }, [isOpen]);

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          minHeight: '38px',
          padding: '6px 12px',
          border: '1px solid var(--color-hairline)',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--color-surface)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 'var(--text-body-sm-size)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
          userSelect: 'none'
        }}
      >
        <span style={{ color: selectedOption ? 'var(--color-ink)' : 'var(--color-mute)' }}>
          {selectedOption ? selectedOption.label : emptyLabel}
        </span>
        <span style={{ color: 'var(--color-mute)', fontSize: '9px', opacity: 0.7 }}>▼</span>
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-hairline)',
          borderRadius: 'var(--radius-sm)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 1000,
          padding: '6px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <input
            type="text"
            placeholder={placeholder || "Gõ để tìm kiếm..."}
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
            style={{
              width: '100%',
              padding: '8px 10px',
              border: '1px solid var(--color-hairline)',
              borderRadius: '4px',
              fontSize: 'var(--text-body-sm-size)',
              outline: 'none',
              background: 'var(--color-surface-soft)',
              color: 'var(--color-ink)'
            }}
            onClick={e => e.stopPropagation()}
          />
          <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div 
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
              style={{
                padding: '8px 10px',
                cursor: 'pointer',
                borderRadius: '4px',
                background: value === '' ? 'var(--color-primary-soft)' : 'transparent',
                color: value === '' ? 'var(--color-primary)' : 'var(--color-ink)',
                fontSize: 'var(--text-body-sm-size)',
                transition: 'background 0.15s, color 0.15s'
              }}
              onMouseEnter={e => {
                if (value !== '') {
                  e.currentTarget.style.background = 'var(--color-surface-soft)';
                }
              }}
              onMouseLeave={e => {
                if (value !== '') {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              {emptyLabel}
            </div>
            {filteredOptions.map(opt => (
              <div 
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                style={{
                  padding: '8px 10px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  background: value === opt.value ? 'var(--color-primary-soft)' : 'transparent',
                  color: value === opt.value ? 'var(--color-primary)' : 'var(--color-ink)',
                  fontSize: 'var(--text-body-sm-size)',
                  transition: 'background 0.15s, color 0.15s'
                }}
                onMouseEnter={e => {
                  if (value !== opt.value) {
                    e.currentTarget.style.background = 'var(--color-surface-soft)';
                  }
                }}
                onMouseLeave={e => {
                  if (value !== opt.value) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {opt.label}
              </div>
            ))}
            {filteredOptions.length === 0 && (
              <div style={{ padding: '8px 10px', color: 'var(--color-mute)', fontSize: 'var(--text-caption-md-size)', fontStyle: 'italic', textAlign: 'center' }}>
                Không tìm thấy kết quả
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Draggable Session Card ───────────────────────────── */
function SessionCard({ session, isDragging, isConnectedTop, isConnectedBottom, hideTeacherName, onEdit }) {
  const isPinned = session.is_pinned;
  const colors = getSessionColor(session);
  const role = session.assigned_role || '';

  const borderRadius = `${isConnectedTop ? '0' : 'var(--radius-sm)'} ${isConnectedTop ? '0' : 'var(--radius-sm)'} ${isConnectedBottom ? '0' : 'var(--radius-sm)'} ${isConnectedBottom ? '0' : 'var(--radius-sm)'}`;
  
  const borderTop = isConnectedTop ? 'none' : colors.border;
  const borderBottom = isConnectedBottom ? 'none' : colors.border;
  const borderLeft = colors.border;
  const borderRight = colors.border;

  return (
    <div 
      onDoubleClick={() => onEdit && onEdit(session)}
      style={{
        background: colors.bg,
        borderTop, borderBottom, borderLeft, borderRight,
        color: colors.text,
        borderRadius,
        padding: '6px 8px',
        cursor: isPinned ? 'default' : 'grab',
        opacity: isDragging ? 0.5 : 1,
        transition: 'box-shadow 0.15s, transform 0.15s',
        boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,.3)' : 'none',
        height: '100%',
        minHeight: '68px',
        display: 'flex', flexDirection: 'column', gap: 2,
        userSelect: 'none',
        position: 'relative',
        zIndex: isDragging ? 100 : 1
      }}
    >
      {/* Only show header if it's the top of the block, or if dragging */}
      {(!isConnectedTop || isDragging) && (
        <div style={{ fontWeight: 700, fontSize: 'var(--text-body-sm-size)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{session.class_code}</span>
          <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button 
              onClick={(e) => { e.stopPropagation(); onEdit && onEdit(session); }} 
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.text,
                opacity: 0.6,
                padding: '2px',
                borderRadius: '3px',
                transition: 'opacity 0.15s, background 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.background = 'rgba(0,0,0,0.06)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = 0.6; e.currentTarget.style.background = 'none'; }}
              title="Phân công giáo viên lớp này"
            >
              <PencilSimple size={13} weight="bold" />
            </button>
            {isPinned && <PushPin size={13} color="var(--color-accent)" weight="fill" />}
            {!isPinned && <ArrowsOutCardinal size={13} style={{ opacity: 0.6 }} weight="light" />}
          </span>
        </div>
      )}
      
      {/* We can show teacher name on all blocks or just the top. Showing on all is fine if roles change per segment */}
      {(!hideTeacherName) && (
        <div style={{ fontSize: 'var(--text-caption-sm-size)', opacity: 0.85, fontWeight: 500, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: isConnectedTop ? 'auto' : '0' }}>
          <span>{[session.teacher_name, session.ta_name].filter(Boolean).join(' + ') || '—'}</span>
          {(() => {
            const mainRole = session.assigned_role || '';
            const taRole = session.assigned_ta_role || '';
            const rList = [];
            if (mainRole && mainRole !== 'lead_teacher') {
              rList.push(mainRole === 'foreign_teacher' ? 'For' :
                         mainRole === 'ta_solo' ? 'TA Solo' :
                         mainRole === 'ta_support' ? 'TA Support' :
                         mainRole === 'ta_ielts' ? 'TA IELTS' :
                         mainRole === 'ta_kids' ? 'TA Kids' : mainRole);
            }
            if (taRole && taRole !== 'ta_support') {
              rList.push(taRole === 'lead_teacher' ? 'Lead' :
                         taRole === 'foreign_teacher' ? 'For' :
                         taRole === 'ta_solo' ? 'TA Solo' :
                         taRole === 'ta_ielts' ? 'TA IELTS' :
                         taRole === 'ta_kids' ? 'TA Kids' : taRole);
            }
            const label = rList.join(' + ');
            if (!label) return null;
            return (
              <span style={{
                fontSize: '9px',
                padding: '2px 4px',
                borderRadius: '3px',
                background: 'rgba(0,0,0,0.06)',
                textTransform: 'uppercase',
                fontWeight: 700,
                letterSpacing: '0.02em',
                opacity: 0.8
              }}>
                {label}
              </span>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function DraggableSession({ session, isConnectedTop, isConnectedBottom, hideTeacherName, onEdit }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: session.id,
    data: session,
    disabled: session.is_pinned, // Pinned sessions can't be dragged
  })

  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={{ height: '100%' }}>
      <SessionCard 
        session={session} 
        isDragging={isDragging} 
        isConnectedTop={isConnectedTop} 
        isConnectedBottom={isConnectedBottom} 
        hideTeacherName={hideTeacherName}
        onEdit={onEdit}
      />
    </div>
  )
}

/* ── Droppable Cell ───────────────────────────────────── */
function DroppableCell({ cellId, children, isOver, isConnectedTop, isConnectedBottom }) {
  const { setNodeRef } = useDroppable({ id: cellId })
  return (
    <td
      ref={setNodeRef}
      style={{
        borderRight: '1px solid var(--color-hairline)',
        borderBottom: isConnectedBottom ? 'none' : '1px solid var(--color-hairline)',
        paddingTop: isConnectedTop ? '0' : '4px',
        paddingBottom: isConnectedBottom ? '0' : '4px',
        paddingLeft: '4px',
        paddingRight: '4px',
        verticalAlign: 'top',
        height: '76px',
        background: isOver ? 'rgba(118, 185, 0, 0.06)' : 'transparent',
        transition: 'background 0.15s',
        minWidth: '140px',
      }}
    >
      {children}
    </td>
  )
}

/* ── Main Grid Component ──────────────────────────────── */
export default function ScheduleGridTab({ weekId }) {
  const [sessions, setSessions] = useState([])
  const [rooms, setRooms] = useState([])
  const [timeSlots, setTimeSlots] = useState([])
  const [persons, setPersons] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeSession, setActiveSession] = useState(null)
  const [overCellId, setOverCellId] = useState(null)
  
  const [editingGroup, setEditingGroup] = useState([])
  const [groupEdits, setGroupEdits] = useState({})
  const [viewMode, setViewMode] = useState('grid')
  
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportFormat, setExportFormat] = useState('excel')
  const [exportViews, setExportViews] = useState({ grid: true, class: true, teacher: true })
  const [isExporting, setIsExporting] = useState(false)

  const toast = useToast()

  const handleExportCustom = async () => {
    setIsExporting(true);
    try {
      const selectedViews = [];
      if (exportViews.grid) selectedViews.push('grid');
      if (exportViews.class) selectedViews.push('class');
      if (exportViews.teacher) selectedViews.push('teacher');

      const res = await api.exportCustom(weekId, exportFormat, selectedViews);
      if (res.url) {
        window.open(res.url, '_blank');
        toast.success('Xuất thời khóa biểu thành công!');
        setShowExportModal(false);
      } else {
        toast.error('Không nhận được đường dẫn tải file từ máy chủ');
      }
    } catch (err) {
      console.error(err);
      toast.error('Có lỗi xảy ra khi xuất thời khóa biểu: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const load = useCallback(() => {
    Promise.all([
      api.getSessions(weekId),
      api.getRooms(),
      api.getTimeSlots(),
      api.getPersons()
    ]).then(([sess, rms, slots, pers]) => {
      setSessions(sess)
      setRooms(rms)
      setTimeSlots(slots)
      setPersons(pers)
      setLoading(false)
    }).catch(console.error)
  }, [weekId])

  useEffect(() => { load() }, [load])

  const cellId = (tsId, roomId) => `${tsId}__${roomId}`
  const parseCell = (id) => { const [tsId, roomId] = id.split('__'); return { tsId, roomId } }

  const openEditAssignment = (sess) => {
    const sessTs = timeSlots.find(ts => ts.id === sess.time_slot_id);
    const sessDay = sessTs ? sessTs.day_of_week : null;
    
    const group = sessions.filter(s => {
      if (s.class_id !== sess.class_id) return false;
      const ts = timeSlots.find(slot => slot.id === s.time_slot_id);
      return ts && ts.day_of_week === sessDay;
    }).map(s => {
      const ts = timeSlots.find(slot => slot.id === s.time_slot_id) || {};
      return {
        ...s,
        start_time: ts.start_time || '',
        end_time: ts.end_time || '',
        slot_label: ts.label || s.slot_label,
        day_of_week: ts.day_of_week
      };
    }).sort((a, b) => a.start_time.localeCompare(b.start_time));

    const edits = {};
    group.forEach(s => {
      edits[s.id] = {
        person_id: s.person_id || '',
        assigned_role: s.assigned_role || 'lead_teacher',
        ta_id: s.ta_id || '',
        assigned_ta_role: s.assigned_ta_role || 'ta_support'
      };
    });

    setEditingGroup(group);
    setGroupEdits(edits);
  }

  const handleSaveAssignment = async () => {
    try {
      await Promise.all(
        editingGroup.map(s => {
          const edit = groupEdits[s.id] || {};
          return api.updateSessionAssignment(
            s.id,
            edit.person_id || null,
            edit.assigned_role,
            edit.ta_id || null,
            edit.assigned_ta_role
          );
        })
      );
      toast.success('Cập nhật phân công giáo viên thành công!');
      setEditingGroup([]);
      setGroupEdits({});
      load(); // Reload sessions to update grid
    } catch (err) {
      toast.error('Lỗi khi phân công giáo viên: ' + err.message);
    }
  }


  /* ── DnD Handlers ─────────────────────────────────── */
  const handleDragStart = (event) => {
    setActiveSession(event.active.data.current)
  }

  const handleDragOver = (event) => {
    setOverCellId(event.over?.id || null)
  }

  const handleDragEnd = async (event) => {
    setActiveSession(null)
    setOverCellId(null)

    const { active, over } = event
    if (!over) return

    const session = active.data.current
    if (session.is_pinned) return

    const target = parseCell(over.id)
    // Don't move if same cell
    if (session.time_slot_id === target.tsId && session.room_id === target.roomId) return

    // Check if target cell is occupied
    const occupant = sessions.find(s => s.time_slot_id === target.tsId && s.room_id === target.roomId)
    if (occupant) return // Can't drop on occupied cell

    // Optimistic UI update
    setSessions(prev => prev.map(s =>
      s.id === session.id ? { ...s, time_slot_id: target.tsId, room_id: target.roomId } : s
    ))

    // Persist to backend
    try {
      const res = await fetch(`/api/sessions/${session.id}/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time_slot_id: target.tsId, room_id: target.roomId })
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Move failed')
      }
    } catch (err) {
      console.error('Move failed:', err)
      toast.error(err.message)
      load() // Rollback by reloading
    }
  }

  if (loading) return <div style={{ padding: 'var(--space-xl)', color: 'var(--color-mute)' }}>Đang tải bảng tính...</div>

  const days = [2, 3, 4, 5, 6, 7, 8]
  const dayNames = { 2: 'Thứ 2', 3: 'Thứ 3', 4: 'Thứ 4', 5: 'Thứ 5', 6: 'Thứ 6', 7: 'Thứ 7', 8: 'Chủ nhật' }

  // Grouping by Classes
  const classesMap = {};
  sessions.forEach(s => {
    if (!classesMap[s.class_id]) {
      classesMap[s.class_id] = {
        id: s.class_id,
        code: s.class_code,
        class_type: s.class_type,
        sessions: []
      };
    }
    classesMap[s.class_id].sessions.push(s);
  });
  const classesList = Object.values(classesMap).sort((a, b) => a.code.localeCompare(b.code));

  // Grouping by Teachers
  const teachersMap = {
    'unassigned': {
      id: 'unassigned',
      name: 'Chưa phân công',
      short_name: 'Chưa phân công',
      sessions: []
    }
  };
  persons.forEach(p => {
    teachersMap[p.id] = {
      id: p.id,
      name: p.full_name || p.name,
      short_name: p.short_name,
      capabilities: p.capabilities,
      sessions: []
    };
  });
  sessions.forEach(s => {
    if (s.person_id && teachersMap[s.person_id]) {
      teachersMap[s.person_id].sessions.push(s);
    } else {
      teachersMap['unassigned'].sessions.push(s);
    }
  });
  const teachersList = Object.values(teachersMap)
    .filter(t => t.id === 'unassigned' ? t.sessions.length > 0 : true)
    .sort((a, b) => {
      if (a.id === 'unassigned') return -1;
      if (b.id === 'unassigned') return 1;
      return a.short_name.localeCompare(b.short_name);
    });

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
      <div style={{ overflowX: 'auto', paddingBottom: 'var(--space-xl)' }}>
        {sessions.length === 0 ? (
          <div className="empty-state">
            <Books size={48} weight="light" />
            <p>Tuần này chưa có lịch nào. Hãy bấm <strong>"Chạy Solver"</strong> để hệ thống xếp lịch tự động.</p>
          </div>
        ) : (
          <>
            {/* View Mode & Export Switcher Header */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: 'var(--space-md)', 
              background: 'var(--color-surface-soft)', 
              padding: '10px var(--space-md)', 
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-hairline)',
              flexWrap: 'wrap',
              gap: 'var(--space-md)'
            }}>
              <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 'var(--text-caption-md-size)', color: 'var(--color-mute)' }}>Chế độ xem:</span>
                <div style={{ display: 'flex', background: 'var(--color-surface)', border: '1px solid var(--color-hairline)', borderRadius: 'var(--radius-sm)', padding: '2px' }}>
                  <button 
                    onClick={() => setViewMode('grid')} 
                    style={{
                      border: 'none',
                      background: viewMode === 'grid' ? 'var(--color-primary)' : 'transparent',
                      color: viewMode === 'grid' ? '#000' : 'var(--color-ink)',
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    Lưới phòng học
                  </button>
                  <button 
                    onClick={() => setViewMode('class')} 
                    style={{
                      border: 'none',
                      background: viewMode === 'class' ? 'var(--color-primary)' : 'transparent',
                      color: viewMode === 'class' ? '#000' : 'var(--color-ink)',
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    TKB theo Lớp học
                  </button>
                  <button 
                    onClick={() => setViewMode('teacher')} 
                    style={{
                      border: 'none',
                      background: viewMode === 'teacher' ? 'var(--color-primary)' : 'transparent',
                      color: viewMode === 'teacher' ? '#000' : 'var(--color-ink)',
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    TKB theo Giáo viên
                  </button>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <button onClick={() => setShowExportModal(true)} className="btn-outline btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <Download size={18} weight="light" /> Xuất TKB
                </button>
              </div>
            </div>

            {/* Legends (Only relevant for Grid View but nice to show overall status summary) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)', fontSize: 'var(--text-caption-sm-size)' }}>
              <div style={{ display: 'flex', gap: 'var(--space-lg)', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 2, background: 'hsla(220, 85%, 95%, 1)', border: '1.5px solid hsla(220, 70%, 55%, 0.8)' }} />
                  GV Chính ({sessions.filter(s => {
                    const caps = s.teacher_capabilities || [];
                    return caps.includes('lead_teacher') && !caps.includes('foreign_teacher') && !caps.some(c => c.startsWith('ta'));
                  }).length})
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 2, background: 'hsla(120, 85%, 95%, 1)', border: '1.5px solid hsla(120, 70%, 55%, 0.8)' }} />
                  GV Nước ngoài ({sessions.filter(s => (s.teacher_capabilities || []).includes('foreign_teacher')).length})
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 2, background: 'hsla(320, 85%, 95%, 1)', border: '1.5px solid hsla(320, 70%, 55%, 0.8)' }} />
                  Trợ giảng TA ({sessions.filter(s => (s.teacher_capabilities || []).some(c => c.startsWith('ta'))).length})
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 2, background: 'hsla(200, 85%, 95%, 1)', border: '1.5px solid hsla(200, 70%, 55%, 0.8)' }} />
                  Chưa xếp GV ({sessions.filter(s => !s.teacher_name).length})
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <PushPin size={13} color="var(--color-accent)" weight="fill" />
                  Gán cứng ({sessions.filter(s => s.is_pinned).length})
                </div>
                {viewMode === 'grid' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-mute)' }}>
                    <ArrowsOutCardinal size={14} /> Kéo thả để di chuyển
                  </div>
                )}
              </div>
            </div>

            {/* View Mode Rendering */}
            {viewMode === 'grid' && (
              <div style={{ maxHeight: 'calc(100vh - 330px)', overflow: 'auto', border: '1px solid var(--color-hairline)', borderRadius: 'var(--radius-sm)' }}>
                <table className="data-table" style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', tableLayout: 'fixed', minWidth: '1000px', border: 'none', overflow: 'visible' }}>
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
                              borderTop: '1px solid var(--color-hairline)',
                              borderBottom: '1px solid var(--color-hairline)',
                              fontSize: 'var(--text-body-sm-size)',
                              letterSpacing: '0.03em'
                            }}
                          >
                            {dayNames[day]}
                          </td>
                        </tr>
                        {daySlots.map((ts, index) => (
                          <tr key={ts.id}>
                            <td style={{
                              fontWeight: 600, fontSize: 'var(--text-caption-sm-size)',
                              borderRight: '1px solid var(--color-hairline)',
                              borderBottom: '1px solid var(--color-hairline)',
                              textAlign: 'center', color: 'var(--color-mute)'
                            }}>
                              {ts.start_time.slice(0, 5)}<br />{ts.end_time.slice(0, 5)}
                            </td>
                            {rooms.map(r => {
                              const cId = cellId(ts.id, r.id)
                              const session = sessions.find(s => s.time_slot_id === ts.id && s.room_id === r.id)
                              
                              let isConnectedTop = false;
                              let isConnectedBottom = false;
                              let hideTeacherName = false;
                              
                              if (session) {
                                const prevTs = daySlots[index - 1];
                                const nextTs = daySlots[index + 1];
                                
                                if (prevTs) {
                                  const prevSession = sessions.find(s => 
                                    s.time_slot_id === prevTs.id && 
                                    s.room_id === r.id
                                  );
                                  if (prevSession && prevSession.class_id === session.class_id) {
                                    isConnectedTop = true;
                                    if (prevSession.teacher_name === session.teacher_name) {
                                      hideTeacherName = true;
                                    }
                                  }
                                }
                                
                                if (nextTs) {
                                  isConnectedBottom = sessions.some(s => 
                                    s.time_slot_id === nextTs.id && 
                                    s.room_id === r.id && 
                                    s.class_id === session.class_id
                                  );
                                }
                              }

                              return (
                                <DroppableCell 
                                  key={cId} 
                                  cellId={cId} 
                                  isOver={overCellId === cId}
                                  isConnectedTop={isConnectedTop}
                                  isConnectedBottom={isConnectedBottom}
                                >
                                  {session && (
                                    <DraggableSession 
                                      session={session} 
                                      isConnectedTop={isConnectedTop}
                                      isConnectedBottom={isConnectedBottom}
                                      hideTeacherName={hideTeacherName}
                                      onEdit={openEditAssignment}
                                    />
                                  )}
                                </DroppableCell>
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

            {/* Class collapsed View */}
            {viewMode === 'class' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-md)', maxHeight: 'calc(100vh - 330px)', overflowY: 'auto', paddingRight: '4px' }}>
                {classesList.map(cls => (
                  <div key={cls.id} style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-hairline)',
                    borderRadius: 'var(--radius-sm)',
                    padding: 'var(--space-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)', borderBottom: '1px solid var(--color-hairline)', paddingBottom: 'var(--space-xs)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                          <span style={{ fontSize: 'var(--text-heading-sm-size)', fontWeight: 700, color: 'var(--color-primary-dark)' }}>{cls.code}</span>
                          <span className={`chip ${cls.class_type === 'ielts' ? 'chip-pink' : 'chip-green'}`} style={{ fontSize: '9px', padding: '1px 6px' }}>
                            {cls.class_type}
                          </span>
                        </div>
                        <span style={{ fontSize: 'var(--text-caption-sm-size)', color: 'var(--color-mute)', fontWeight: 500 }}>
                          {cls.sessions.length} tiết / tuần
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {mergeContiguousSessions(cls.sessions, timeSlots).map(s => {
                          return (
                            <div key={s.id} style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center', 
                              padding: '8px', 
                              background: 'var(--color-surface-soft)', 
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--color-hairline)'
                            }}>
                              <div style={{ fontSize: 'var(--text-caption-md-size)' }}>
                                <div style={{ fontWeight: 700, color: 'var(--color-ink)' }}>
                                  {dayNames[s.day_of_week] || s.day_of_week} ({s.start_time?.slice(0,5)} - {s.end_time?.slice(0,5)})
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--color-mute)', marginTop: '2px' }}>
                                  Phòng: <strong style={{ color: 'var(--color-ink)' }}>{s.room_name}</strong>
                                </div>
                                <div style={{ fontSize: '13px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {s.teacher_name ? (
                                    <>
                                      <span style={{ fontWeight: 600 }}>{s.teacher_name}</span>
                                      {s.assigned_role && s.assigned_role !== 'lead_teacher' && (
                                        <span style={{ fontSize: '9px', background: 'rgba(0,0,0,0.06)', padding: '1px 4px', borderRadius: '3px', textTransform: 'uppercase', fontWeight: 700 }}>
                                          {s.assigned_role === 'foreign_teacher' ? 'Foreign' :
                                           s.assigned_role === 'ta_solo' ? 'TA Solo' :
                                           s.assigned_role === 'ta_support' ? 'TA Support' :
                                           s.assigned_role === 'ta_ielts' ? 'TA IELTS' :
                                           s.assigned_role === 'ta_kids' ? 'TA Kids' : s.assigned_role}
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    <span style={{ color: 'var(--color-error)', fontStyle: 'italic', fontWeight: 500 }}>Chưa phân công giáo viên</span>
                                  )}
                                </div>
                              </div>
                              <button 
                                onClick={() => openEditAssignment(s)}
                                style={{
                                  background: 'var(--color-surface)',
                                  border: '1px solid var(--color-hairline)',
                                  borderRadius: '4px',
                                  width: '26px',
                                  height: '26px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  color: 'var(--color-mute)',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                }}
                                title="Sửa phân công tiết học"
                              >
                                <PencilSimple size={14} weight="bold" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Teacher View */}
            {viewMode === 'teacher' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-md)', maxHeight: 'calc(100vh - 330px)', overflowY: 'auto', paddingRight: '4px' }}>
                {teachersList.map(t => (
                  <div key={t.id} style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-hairline)',
                    borderRadius: 'var(--radius-sm)',
                    padding: 'var(--space-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)', borderBottom: '1px solid var(--color-hairline)', paddingBottom: 'var(--space-xs)' }}>
                        <div>
                          <span style={{ fontSize: 'var(--text-heading-sm-size)', fontWeight: 700, color: t.id === 'unassigned' ? 'var(--color-error)' : 'var(--color-primary-dark)' }}>
                            {t.short_name}
                          </span>
                          {t.id !== 'unassigned' && t.name && t.name !== t.short_name && (
                            <span style={{ fontSize: '11px', color: 'var(--color-mute)', marginLeft: '6px' }}>({t.name})</span>
                          )}
                        </div>
                        <span style={{ fontSize: 'var(--text-caption-sm-size)', color: 'var(--color-mute)', fontWeight: 500 }}>
                          {t.sessions.length} tiết / tuần
                        </span>
                      </div>
                      
                      {t.sessions.length === 0 ? (
                        <div style={{ color: 'var(--color-mute)', fontStyle: 'italic', padding: '12px 0', textAlign: 'center', fontSize: 'var(--text-caption-md-size)' }}>
                          Không có lịch dạy trong tuần này.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {mergeContiguousSessions(t.sessions, timeSlots).map(s => {
                            return (
                              <div key={s.id} style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                padding: '8px', 
                                background: 'var(--color-surface-soft)', 
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--color-hairline)'
                              }}>
                                <div style={{ fontSize: 'var(--text-caption-md-size)' }}>
                                  <div style={{ fontWeight: 700, color: 'var(--color-ink)' }}>
                                    {dayNames[s.day_of_week] || s.day_of_week} ({s.start_time?.slice(0,5)} - {s.end_time?.slice(0,5)})
                                  </div>
                                  <div style={{ fontSize: '13px', marginTop: '4px' }}>
                                    Lớp: <strong style={{ color: 'var(--color-primary-dark)' }}>{s.class_code}</strong> | Phòng: <strong>{s.room_name}</strong>
                                  </div>
                                  {s.assigned_role && (
                                    <div style={{ marginTop: '4px' }}>
                                      <span style={{ fontSize: '9px', background: 'rgba(0,0,0,0.06)', padding: '1px 6px', borderRadius: '3px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.02em' }}>
                                        {s.assigned_role === 'lead_teacher' ? 'GV Chính' : 
                                         s.assigned_role === 'foreign_teacher' ? 'GV Nước Ngoài' : 
                                         s.assigned_role === 'ta_solo' ? 'TA Độc Lập' : 
                                         s.assigned_role === 'ta_support' ? 'TA Hỗ Trợ' : 
                                         s.assigned_role === 'ta_ielts' ? 'TA IELTS' : s.assigned_role === 'ta_kids' ? 'TA Kids' : s.assigned_role}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <button 
                                  onClick={() => openEditAssignment(s)}
                                  style={{
                                    background: 'var(--color-surface)',
                                    border: '1px solid var(--color-hairline)',
                                    borderRadius: '4px',
                                    width: '26px',
                                    height: '26px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    color: 'var(--color-mute)',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                  }}
                                  title="Sửa phân công tiết học"
                                >
                                  <PencilSimple size={14} weight="bold" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Drag overlay — follows cursor */}
      <DragOverlay>
        {activeSession && <SessionCard session={activeSession} isDragging hideTeacherName={false} />}
      </DragOverlay>

      {/* Edit Assignment Modal */}
      {editingGroup.length > 0 && (
        <div className="modal-overlay" onClick={() => setEditingGroup([])}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)', borderBottom: '1px solid var(--color-hairline)', paddingBottom: 'var(--space-sm)' }}>
              <div>
                <h2 className="modal-title" style={{ margin: 0, fontSize: 'var(--text-heading-sm-size)' }}>Phân công Giáo viên</h2>
                <div style={{ fontSize: 'var(--text-caption-md-size)', color: 'var(--color-mute)', marginTop: '2px' }}>
                  Lớp: <strong style={{ color: 'var(--color-primary-dark)' }}>{editingGroup[0].class_code}</strong>
                </div>
              </div>
              <button onClick={() => setEditingGroup([])} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--color-mute)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ maxHeight: '420px', overflowY: 'auto', paddingRight: '6px', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {editingGroup.map((s, idx) => {
                const edit = groupEdits[s.id] || { person_id: '', assigned_role: 'lead_teacher', ta_id: '', assigned_ta_role: 'ta_support' };
                
                const personOptions = persons.map(p => {
                  const caps = p.capabilities || [];
                  const capStr = caps.length > 0 ? ` (${caps.join(', ')})` : '';
                  return {
                    value: p.id,
                    label: `${p.short_name} - ${p.full_name || p.name}${capStr}`
                  };
                });

                return (
                  <div key={s.id} style={{ padding: 'var(--space-md)', background: 'var(--color-surface-soft)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-hairline)' }}>
                    <div style={{ fontWeight: 700, fontSize: 'var(--text-body-sm-size)', color: 'var(--color-ink)', marginBottom: 'var(--space-sm)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Tiết {idx + 1}: {s.slot_label} ({s.start_time.slice(0,5)} - {s.end_time.slice(0,5)})</span>
                      <span style={{ fontSize: 'var(--text-caption-sm-size)', color: 'var(--color-mute)', fontWeight: 500 }}>Phòng: {s.room_name}</span>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                      {/* Lead Teacher Selection */}
                      <div style={{ display: 'flex', gap: 'var(--space-md)', flexDirection: 'row', flexWrap: 'wrap' }}>
                        <div className="form-group" style={{ flex: '1 1 200px', marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', display: 'block' }}>Giáo viên / TA chính</label>
                          <SearchableSelect
                            options={personOptions}
                            value={edit.person_id}
                            onChange={val => {
                              setGroupEdits(prev => ({
                                ...prev,
                                [s.id]: { ...prev[s.id], person_id: val }
                              }));
                            }}
                            placeholder="Tìm giáo viên..."
                            emptyLabel="— Chưa phân công (Trống) —"
                          />
                        </div>

                        <div className="form-group" style={{ flex: '1 1 200px', marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', display: 'block' }}>Vai trò chính</label>
                          <select
                            className="select-input"
                            value={edit.assigned_role}
                            onChange={e => {
                              const val = e.target.value;
                              setGroupEdits(prev => ({
                                ...prev,
                                [s.id]: { ...prev[s.id], assigned_role: val }
                              }));
                            }}
                            style={{ width: '100%', height: '38px' }}
                          >
                            <option value="lead_teacher">Giáo viên chính (Lead Teacher)</option>
                            <option value="foreign_teacher">Giáo viên nước ngoài (Foreign Teacher)</option>
                            <option value="ta_solo">Trợ giảng độc lập (TA Solo)</option>
                            <option value="ta_support">Trợ giảng hỗ trợ (TA Support)</option>
                            <option value="ta_ielts">Trợ giảng IELTS (TA IELTS)</option>
                            <option value="ta_kids">Trợ giảng Kids (TA Kids)</option>
                          </select>
                        </div>
                      </div>

                      {/* TA / Support Teacher Selection */}
                      <div style={{ display: 'flex', gap: 'var(--space-md)', flexDirection: 'row', flexWrap: 'wrap', marginTop: '4px' }}>
                        <div className="form-group" style={{ flex: '1 1 200px', marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', display: 'block' }}>Trợ giảng (TA phụ)</label>
                          <SearchableSelect
                            options={personOptions}
                            value={edit.ta_id}
                            onChange={val => {
                              setGroupEdits(prev => ({
                                ...prev,
                                [s.id]: { ...prev[s.id], ta_id: val }
                              }));
                            }}
                            placeholder="Tìm trợ giảng..."
                            emptyLabel="— Không có trợ giảng —"
                          />
                        </div>

                        <div className="form-group" style={{ flex: '1 1 200px', marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', display: 'block' }}>Vai trò trợ giảng</label>
                          <select
                            className="select-input"
                            value={edit.assigned_ta_role}
                            onChange={e => {
                              const val = e.target.value;
                              setGroupEdits(prev => ({
                                ...prev,
                                [s.id]: { ...prev[s.id], assigned_ta_role: val }
                              }));
                            }}
                            style={{ width: '100%', height: '38px' }}
                          >
                            <option value="ta_support">Trợ giảng hỗ trợ (TA Support)</option>
                            <option value="ta_solo">Trợ giảng độc lập (TA Solo)</option>
                            <option value="ta_ielts">Trợ giảng IELTS (TA IELTS)</option>
                            <option value="ta_kids">Trợ giảng Kids (TA Kids)</option>
                            <option value="lead_teacher">Giáo viên chính (Lead Teacher)</option>
                            <option value="foreign_teacher">Giáo viên nước ngoài (Foreign Teacher)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="modal-actions" style={{ marginTop: 'var(--space-xl)', borderTop: '1px solid var(--color-hairline)', paddingTop: 'var(--space-md)' }}>
              <button className="btn-outline btn-sm" onClick={() => setEditingGroup([])}>Hủy</button>
              <button className="btn-primary btn-sm" onClick={handleSaveAssignment}>Lưu tất cả</button>
            </div>
          </div>
        </div>
      )}

      {/* Export Options Modal */}
      {showExportModal && (
        <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
              <h2 className="modal-title" style={{ margin: 0 }}>Tùy chọn Xuất TKB</h2>
              <button onClick={() => setShowExportModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--color-mute)' }}>
                <X size={20} />
              </button>
            </div>
            
            <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
              <label className="form-label">Định dạng xuất</label>
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <button
                  type="button"
                  onClick={() => setExportFormat('excel')}
                  className={exportFormat === 'excel' ? 'btn-primary btn-sm' : 'btn-outline btn-sm'}
                  style={{ flex: 1, display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}
                >
                  <FileXls size={16} /> Excel (.xlsx)
                </button>
                <button
                  type="button"
                  onClick={() => setExportFormat('pdf')}
                  className={exportFormat === 'pdf' ? 'btn-primary btn-sm' : 'btn-outline btn-sm'}
                  style={{ flex: 1, display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}
                >
                  <FilePdf size={16} /> PDF (.pdf)
                </button>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
              <label className="form-label" style={{ marginBottom: 'var(--space-sm)' }}>Chọn Chế độ xem muốn xuất</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 'var(--text-body-sm-size)' }}>
                  <input
                    type="checkbox"
                    checked={exportViews.grid}
                    onChange={e => setExportViews({ ...exportViews, grid: e.target.checked })}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>Lưới phòng học</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 'var(--text-body-sm-size)' }}>
                  <input
                    type="checkbox"
                    checked={exportViews.class}
                    onChange={e => setExportViews({ ...exportViews, class: e.target.checked })}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>TKB theo lớp học</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 'var(--text-body-sm-size)' }}>
                  <input
                    type="checkbox"
                    checked={exportViews.teacher}
                    onChange={e => setExportViews({ ...exportViews, teacher: e.target.checked })}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>TKB theo giáo viên</span>
                </label>
              </div>
              {exportFormat === 'excel' && (
                <div style={{ marginTop: 'var(--space-sm)', fontSize: 'var(--text-caption-sm-size)', color: 'var(--color-mute)' }}>
                  * Mỗi chế độ xem đã chọn sẽ được xuất thành một Sheet riêng biệt trong file Excel.
                </div>
              )}
            </div>

            <div className="modal-actions" style={{ marginTop: 'var(--space-xl)' }}>
              <button className="btn-outline btn-sm" onClick={() => setShowExportModal(false)} disabled={isExporting}>
                Hủy
              </button>
              <button
                className="btn-primary btn-sm"
                onClick={handleExportCustom}
                disabled={isExporting || (!exportViews.grid && !exportViews.class && !exportViews.teacher)}
              >
                {isExporting ? 'Đang xuất...' : 'Xuất file'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DndContext>
  )
}
