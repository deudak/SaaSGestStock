import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FaTimes } from "react-icons/fa";

const widths = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
};

const openStack = [];

/**
 * Fenêtre modale claire. Se ferme avec Échap ou un clic sur le fond.
 * Sur mobile elle s'affiche en bas de l'écran (bottom sheet).
 */
export default function Modal({ isOpen, onClose, title, description, size = "md", footer, children }) {
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const token = {};
    openStack.push(token);
    const handleKey = (event) => {
      // Seule la modale au premier plan réagit à Échap
      if (event.key === "Escape" && openStack[openStack.length - 1] === token) onCloseRef.current?.();
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKey);
    const firstField = panelRef.current?.querySelector("input:not([type=hidden]):not([readonly]), select, textarea");
    firstField?.focus();
    return () => {
      openStack.splice(openStack.indexOf(token), 1);
      if (openStack.length === 0) document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 animate-fade-in bg-slate-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panelRef}
        className={`relative flex max-h-[92vh] w-full animate-pop-in flex-col overflow-hidden rounded-t-2xl bg-white shadow-pop sm:rounded-2xl ${widths[size]}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fermer"
          >
            <FaTimes size={14} />
          </button>
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3.5 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
