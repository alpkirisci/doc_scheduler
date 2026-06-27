"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui";
import { useI18n } from "@/i18n/I18nProvider";

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (o: ConfirmOptions) => Promise<boolean>;
const Ctx = createContext<ConfirmFn>(() => Promise.resolve(false));
export const useConfirm = () => useContext(Ctx);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (o) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve;
        setOpts(o);
      }),
    [],
  );

  function close(v: boolean) {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  }

  return (
    <Ctx.Provider value={confirm}>
      {children}
      {opts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade"
            onClick={() => close(false)}
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl animate-pop">
            <div className="flex items-start gap-3">
              {opts.danger && (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                  <AlertTriangle className="h-5 w-5" />
                </span>
              )}
              <div>
                <h3 className="text-base font-semibold text-slate-900">{opts.title}</h3>
                {opts.message && <p className="mt-1.5 text-sm text-slate-600">{opts.message}</p>}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => close(false)}>
                {opts.cancelLabel ?? t.common.cancel}
              </Button>
              <Button variant={opts.danger ? "dangerSolid" : "primary"} onClick={() => close(true)}>
                {opts.confirmLabel ?? t.common.confirm}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
