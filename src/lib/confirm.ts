// Promise-based confirm() dialog API. Replaces native window.confirm so we
// can render a styled, on-brand modal that's also nicer on mobile (the
// native dialog is jarring on iOS and crops badly on small screens).
//
// Usage:
//   if (await confirm({ title: 'Delete?', message: '…', danger: true })) { … }
//
// The actual dialog is rendered by <ConfirmHost /> mounted once in <App />.

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export interface ConfirmRequest extends ConfirmOptions {
  id: number;
  resolve: (ok: boolean) => void;
}

type Listener = (req: ConfirmRequest | null) => void;

let nextId = 1;
let listener: Listener | null = null;
let pending: ConfirmRequest | null = null;

export function _registerConfirmListener(cb: Listener): () => void {
  listener = cb;
  // Replay any in-flight request so a late-mounted host still resolves it.
  if (pending) cb(pending);
  return () => {
    if (listener === cb) listener = null;
  };
}

export function confirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const req: ConfirmRequest = { id: nextId++, ...opts, resolve };
    pending = req;
    if (listener) listener(req);
    else {
      // No host mounted yet — fall back to native so we never silently drop
      // a destructive confirmation. (Should only hit during early boot.)
      const ok = window.confirm(opts.message);
      pending = null;
      resolve(ok);
    }
  });
}

// Called by the host when the user picks an answer.
export function _resolveConfirm(req: ConfirmRequest, ok: boolean): void {
  if (pending && pending.id === req.id) pending = null;
  req.resolve(ok);
  if (listener) listener(null);
}
