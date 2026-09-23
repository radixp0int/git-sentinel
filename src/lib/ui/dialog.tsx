import { useEffect, useId, useRef, type ReactNode } from 'react';

/**
 * A modal built on the native `<dialog>`, which brings focus trapping, Escape
 * to close and an inert page behind it without any code of ours.
 *
 * `open` is the source of truth; every way of closing (Escape, a footer
 * button) goes through `onClose` so the owner can record it.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer: ReactNode;
}) {
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
      className="dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Let the owner close it, so `open` and the element never disagree.
        event.preventDefault();
        onClose();
      }}
    >
      <h2 id={titleId} className="dialog-title">
        {title}
      </h2>
      <div className="dialog-body">{children}</div>
      <div className="dialog-footer">{footer}</div>
    </dialog>
  );
}
