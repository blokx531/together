import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { IconButton } from './Button';

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Optional description shown under the title. */
  description?: string;
}

/**
 * Bottom sheet on phones, centred dialog on wider screens. Built on native <dialog>, which gives
 * focus trapping, Escape-to-close and an inert background for free.
 */
export function Sheet({ open, title, onClose, children, description }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {open ? (
        <div className="flex max-h-[inherit] flex-col">
          <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-2">
            <div className="pt-2">
              <h2 id={titleId} className="text-lg font-semibold">
                {title}
              </h2>
              {description ? <p className="mt-0.5 text-sm text-ink-muted">{description}</p> : null}
            </div>
            <IconButton label="Close" onClick={onClose}>
              <X className="size-5" aria-hidden />
            </IconButton>
          </header>
          <div className="overflow-y-auto px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
