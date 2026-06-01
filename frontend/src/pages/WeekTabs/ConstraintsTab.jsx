import { useState, useEffect } from 'react'
import { api } from '../../services/api'
import { Sparkle, Trash, Check, X, Info } from '@phosphor-icons/react'
import { useToast } from '../../components/layout/Toast'
import { useConfirm } from '../../components/layout/ConfirmModal'

export default function ConstraintsTab({ weekId }) {
  const toast = useToast()
  const confirm = useConfirm()
  const [constraints, setConstraints] = useState([])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)

  const load = () => api.getConstraints(weekId).then(setConstraints).catch(console.error)
  useEffect(() => { load() }, [weekId])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!inputText.trim()) return
    setLoading(true)
    try {
      await api.createConstraint(weekId, inputText)
      setInputText('')
      toast.success('Đã phân tích và thêm ràng buộc mới!')
      load()
    } catch (err) {
      toast.error('Lỗi NLP: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (cid) => {
    const ok = await confirm({
      title: 'Xóa ràng buộc',
      message: 'Bạn có chắc chắn muốn xóa ràng buộc này? Nó sẽ không còn ảnh hưởng đến việc xếp lịch.',
      confirmText: 'Xóa',
      variant: 'danger'
    })
    if (ok) {
      await api.deleteConstraint(weekId, cid)
      toast.success('Đã xóa ràng buộc.')
      load()
    }
  }

  const toggleConfirm = async (c) => {
    await api.updateConstraint(weekId, c.id, { ...c, confirmed_by_user: !c.confirmed_by_user })
    load()
  }

  return (
    <div style={{ maxWidth: '800px' }}>
      <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
        <h2 style={{ fontSize: 'var(--text-heading-md-size)', marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkle size={24} color="var(--color-accent)" weight="fill" />
          Nhập Ràng Buộc NLP
        </h2>
        <p style={{ fontSize: 'var(--text-body-sm-size)', color: 'var(--color-mute)', marginBottom: 'var(--space-lg)' }}>
          Nhập yêu cầu bằng tiếng Việt. AI sẽ tự động phân tích và tạo cấu trúc ràng buộc cho bộ giải mã (Solver).
          <br/>VD: <i>"Cô Jasmine không dạy sáng Thứ 2"</i> hoặc <i>"Thầy Mark chỉ dạy tối đa 4 lớp"</i>
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 'var(--space-md)' }}>
          <input
            className="text-input"
            style={{ flex: 1 }}
            placeholder="Nhập yêu cầu..."
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            disabled={loading}
          />
          <button type="submit" className="btn-primary" disabled={loading || !inputText.trim()}>
            {loading ? 'Đang phân tích...' : 'Phân tích AI'}
          </button>
        </form>
      </div>

      <div>
        <h3 style={{ fontSize: 'var(--text-heading-sm-size)', marginBottom: 'var(--space-md)' }}>
          Danh sách ràng buộc ({constraints.length})
        </h3>
        {constraints.length === 0 ? (
          <div className="empty-state">
            <Info size={48} weight="light" />
            <p>Chưa có ràng buộc nào cho tuần này.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {constraints.map(c => (
              <div key={c.id} className="card card-shell" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--text-body-md-size)', fontWeight: 700, marginBottom: 'var(--space-xs)' }}>
                    "{c.raw_text}"
                  </div>
                  <div style={{ fontSize: 'var(--text-caption-sm-size)', color: 'var(--color-mute)', display: 'flex', gap: 16, alignItems: 'center' }}>
                    <span className="chip chip-gray">Loại: {c.constraint_type}</span>
                    <span>Ưu tiên: {c.priority}/10</span>
                    {c.parsed_json?.subject_person && <span>Đối tượng: <strong>{c.parsed_json.subject_person}</strong></span>}
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
                  <button 
                    onClick={() => toggleConfirm(c)}
                    className={c.confirmed_by_user ? "btn-primary btn-sm" : "btn-outline btn-sm"}
                    style={{ padding: '4px 12px', height: '32px' }}
                  >
                    {c.confirmed_by_user ? <Check size={16} weight="bold" style={{ marginRight: 4 }}/> : 'Duyệt'}
                    {c.confirmed_by_user ? 'Đã duyệt' : ''}
                  </button>
                  <button className="btn-icon" onClick={() => handleDelete(c.id)}>
                    <Trash size={20} weight="light" color="var(--color-error)" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
