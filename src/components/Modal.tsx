import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  maxWidth?: string
}

export function Modal({ isOpen, onClose, title, subtitle, children, maxWidth = 'max-w-lg' }: ModalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.body.style.overflow = 'unset'
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen || !mounted) return null

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity duration-300 modal-backdrop-animate"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Box */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative z-10 w-full ${maxWidth} max-h-[92vh] flex flex-col rounded-3xl border border-white/15 bg-slate-900/95 p-5 sm:p-6 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.15)] backdrop-blur-2xl transition-all duration-300 my-auto modal-box-animate`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-white/10 pb-4 shrink-0">
          <div>
            <h3 id="modal-title" className="text-xl font-bold tracking-tight text-white">
              {title}
            </h3>
            {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition hover:border-white/20 hover:bg-white/10 hover:text-white shrink-0 ml-4"
            aria-label="Đóng hộp thoại"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 overflow-y-auto pr-1 flex-1 custom-scrollbar">{children}</div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
