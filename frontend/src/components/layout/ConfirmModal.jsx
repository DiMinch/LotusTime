import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { Trash, Warning, Info, X } from '@phosphor-icons/react'
import './ConfirmModal.css'

const ConfirmContext = createContext(null)

export function useConfirm() {
  const context = useContext(ConfirmContext)
  if (!context) throw new Error('useConfirm must be used within a ConfirmProvider')
  return context
}

const ICONS = {
  danger:  <Trash size={22} weight="fill" />,
  warning: <Warning size={22} weight="fill" />,
  info:    <Info size={22} weight="fill" />,
}

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null)
  const resolveRef = useRef(null)

  // Returns a Promise<boolean> – resolves true on confirm, false on cancel
  const confirm = useCallback((options = {}) => {
    const {
      title   = 'Xác nhận',
      message = 'Bạn có chắc chắn muốn thực hiện thao tác này?',
      confirmText = 'Xác nhận',
      cancelText  = 'Hủy',
      variant = 'danger',   // 'danger' | 'warning' | 'info'
    } = typeof options === 'string' ? { message: options } : options

    return new Promise((resolve) => {
      resolveRef.current = resolve
      setDialog({ title, message, confirmText, cancelText, variant })
    })
  }, [])

  const handleConfirm = () => {
    resolveRef.current?.(true)
    setDialog(null)
  }

  const handleCancel = () => {
    resolveRef.current?.(false)
    setDialog(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog && (
        <div
          className="confirm-overlay"
          onClick={handleCancel}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
            <div className={`confirm-icon ${dialog.variant}`}>
              {ICONS[dialog.variant]}
            </div>
            <div className="confirm-title" id="confirm-title">{dialog.title}</div>
            <div className="confirm-message">{dialog.message}</div>
            <div className="confirm-actions">
              <button
                className="confirm-btn-cancel"
                onClick={handleCancel}
                autoFocus={dialog.variant !== 'danger'}
              >
                {dialog.cancelText}
              </button>
              <button
                className={`confirm-btn-confirm ${dialog.variant}`}
                onClick={handleConfirm}
                autoFocus={dialog.variant === 'danger'}
              >
                {ICONS[dialog.variant]}
                {dialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
