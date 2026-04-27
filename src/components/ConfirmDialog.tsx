import { useEffect, useRef, useState } from 'react';
import {
  _registerConfirmListener,
  _resolveConfirm,
  type ConfirmRequest,
} from '../lib/confirm';

export function ConfirmHost() {
  const [req, setReq] = useState<ConfirmRequest | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => _registerConfirmListener(setReq), []);

  // Focus management: remember what was focused, focus the primary action
  // when the dialog opens, restore focus when it closes.
  useEffect(() => {
    if (req) {
      const active = document.activeElement;
      if (active instanceof HTMLElement) openerRef.current = active;
      // Wait a tick so the button is actually in the DOM.
      const id = requestAnimationFrame(() => confirmBtnRef.current?.focus());
      document.body.style.overflow = 'hidden';
      return () => {
        cancelAnimationFrame(id);
        document.body.style.overflow = '';
      };
    }
    const opener = openerRef.current;
    if (opener && document.contains(opener)) opener.focus();
    openerRef.current = null;
  }, [req]);

  // Esc cancels, Enter confirms.
  useEffect(() => {
    if (!req) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        _resolveConfirm(req!, false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        _resolveConfirm(req!, true);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [req]);

  if (!req) return null;

  const onConfirm = () => _resolveConfirm(req, true);
  const onCancel = () => _resolveConfirm(req, false);

  return (
    <>
      <div className="confirm-backdrop" onClick={onCancel} aria-hidden="true" />
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={req.title ? `confirm-title-${req.id}` : undefined}
        aria-describedby={`confirm-msg-${req.id}`}
      >
        {req.title && (
          <h2 id={`confirm-title-${req.id}`} className="confirm-title">
            {req.title}
          </h2>
        )}
        <p id={`confirm-msg-${req.id}`} className="confirm-message">
          {req.message}
        </p>
        <div className="confirm-actions">
          <button className="btn-quiet" onClick={onCancel}>
            {req.cancelLabel ?? 'Cancel'}
          </button>
          <button
            ref={confirmBtnRef}
            className={req.danger ? 'btn-primary btn-danger' : 'btn-primary'}
            onClick={onConfirm}
          >
            {req.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </>
  );
}
