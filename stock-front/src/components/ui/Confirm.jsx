/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { FaExclamationTriangle, FaQuestionCircle } from "react-icons/fa";
import Modal from "./Modal";
import Button from "./Button";

import { t } from "../../i18n/index.js";

const ConfirmContext = createContext(null);

/**
 * Remplace window.confirm par une boîte de dialogue stylée.
 * Usage : const confirm = useConfirm(); if (await confirm({ title, message })) { ... }
 */
export function ConfirmProvider({ children }) {
  const [options, setOptions] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((opts) => {
    setOptions({ confirmLabel: t("Confirmer"), tone: "danger", ...opts });
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (result) => {
    resolver.current?.(result);
    resolver.current = null;
    setOptions(null);
  };

  const danger = options?.tone === "danger";
  const Icon = danger ? FaExclamationTriangle : FaQuestionCircle;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        isOpen={Boolean(options)}
        onClose={() => close(false)}
        title={options?.title}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => close(false)}>{t("Annuler")}</Button>
            <Button variant={danger ? "danger" : "primary"} onClick={() => close(true)} autoFocus>
              {options?.confirmLabel}
            </Button>
          </>
        }
      >
        <div className="flex gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${danger ? "bg-rose-50 text-rose-600" : "bg-brand-50 text-brand-600"}`}>
            <Icon size={16} />
          </div>
          <p className="pt-2 text-sm leading-relaxed text-slate-600">{options?.message}</p>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error(t("useConfirm doit être utilisé dans <ConfirmProvider>"));
  return context;
}
