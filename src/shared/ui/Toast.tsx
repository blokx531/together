import { createContext, use, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';

type ToastTone = 'neutral' | 'success' | 'error';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
  action?: { label: string; onAction: () => void } | undefined;
}

interface ToastApi {
  show: (message: string, options?: { tone?: ToastTone; action?: ToastItem['action'] }) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
const TOAST_DURATION_MS = 4_000;
const TOAST_WITH_ACTION_DURATION_MS = 7_000;

const TONE_CLASSES: Record<ToastTone, string> = {
  neutral: 'bg-ink text-bg',
  success: 'bg-ink text-bg',
  error: 'bg-negative text-on-accent',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback<ToastApi['show']>(
    (message, options) => {
      const id = nextId.current++;
      const action = options?.action;
      setToasts((current) => [
        ...current.slice(-2),
        { id, message, tone: options?.tone ?? 'neutral', action },
      ]);
      window.setTimeout(
        () => {
          dismiss(id);
        },
        action ? TOAST_WITH_ACTION_DURATION_MS : TOAST_DURATION_MS,
      );
    },
    [dismiss],
  );

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-control px-4 py-3 text-sm shadow-raised ${TONE_CLASSES[toast.tone]}`}
          >
            <span>{toast.message}</span>
            {toast.action ? (
              <button
                type="button"
                className="font-semibold underline underline-offset-2"
                onClick={() => {
                  toast.action?.onAction();
                  dismiss(toast.id);
                }}
              >
                {toast.action.label}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext>
  );
}

export function useToast(): ToastApi {
  const api = use(ToastContext);
  if (!api) throw new Error('useToast must be used inside <ToastProvider>.');
  return api;
}
