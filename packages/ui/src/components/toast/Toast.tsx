// ═══════════════════════════════════════════════════════════════════
// V39 — Système de Toast global
// Remplace les alert() moches partout dans l'app
//
// Usage :
//   import { useToast } from "../components/Toast";
//   const toast = useToast();
//   toast.success("Document enregistré");
//   toast.error("Erreur de sauvegarde");
//   toast.info("Information");
//   toast.warning("Attention");
//
// Provider à monter UNE FOIS dans App.tsx :
//   <ToastProvider>
//     <Routes>...</Routes>
//   </ToastProvider>
// ═══════════════════════════════════════════════════════════════════
import { createContext, useContext, useState, useCallback } from "react";

type ToastKind = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: string;
  kind: ToastKind;
  message: string;
  duration: number;
  createdAt: number;
}

interface ToastContextType {
  show: (kind: ToastKind, message: string, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

const C = {
  white: "#FFFFFF",
  text: "#0F172A",
  textLight: "#64748B",
  success: "#10B981", successLight: "#D1FAE5", successDark: "#065F46",
  danger: "#DC2626", dangerLight: "#FEE2E2", dangerDark: "#991B1B",
  warning: "#F59E0B", warningLight: "#FEF3C7", warningDark: "#92400E",
  primary: "#b22a45", primaryLight: "#fbeaee", primaryDark: "#79192f",
  border: "#E2E8F0",
};
const FONT = "'IBM Plex Sans', system-ui, sans-serif";

const KIND_STYLE: Record<ToastKind, { bg: string; fg: string; border: string; icon: string }> = {
  success: { bg: C.successLight, fg: C.successDark, border: C.success, icon: "✓" },
  error: { bg: C.dangerLight, fg: C.dangerDark, border: C.danger, icon: "✕" },
  info: { bg: C.primaryLight, fg: C.primaryDark, border: C.primary, icon: "ℹ" },
  warning: { bg: C.warningLight, fg: C.warningDark, border: C.warning, icon: "" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  const show = useCallback((kind: ToastKind, message: string, duration = 4000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const item: ToastItem = { id, kind, message, duration, createdAt: Date.now() };
    setToasts(t => [...t, item]);
    if (duration > 0) {
      setTimeout(() => remove(id), duration);
    }
  }, [remove]);

  const value: ToastContextType = {
    show,
    success: (m, d) => show("success", m, d),
    error: (m, d) => show("error", m, d ?? 6000), // erreurs plus longues
    info: (m, d) => show("info", m, d),
    warning: (m, d) => show("warning", m, d ?? 5000),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Container des toasts — V58.299 a11y : aria-live pour lecteurs d'ecran */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
        position: "fixed", top: 16, right: 16, zIndex: 9999,
        display: "flex", flexDirection: "column", gap: 8,
        maxWidth: "calc(100vw - 32px)", width: 360,
        pointerEvents: "none",
        fontFamily: FONT,
      }}>
        {toasts.map(t => {
          const style = KIND_STYLE[t.kind];
          return (
            <div
              key={t.id}
              style={{
                pointerEvents: "auto",
                background: style.bg,
                color: style.fg,
                border: `1px solid ${style.border}`,
                borderLeft: `4px solid ${style.border}`,
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 13,
                fontWeight: 500,
                lineHeight: 1.4,
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                animation: "toastSlideIn 0.2s ease-out",
              }}
            >
              <span style={{ flex: 1, wordBreak: "break-word" }}>{t.message}</span>
              <button
                onClick={() => remove(t.id)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: style.fg,
                  cursor: "pointer",
                  fontSize: 16,
                  lineHeight: 1,
                  padding: 0,
                  marginLeft: 4,
                  opacity: 0.6,
                }}
                aria-label="Fermer"
              >×</button>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes toastSlideIn {
          from { transform: translateX(20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback pour ne pas crasher si le Provider est manquant
    // → bascule sur alert() comme avant
    console.warn("[useToast] ToastProvider manquant, fallback sur alert()");
    return {
      show: (_, m) => alert(m),
      success: m => alert("✓ " + m),
      error: m => alert("✕ " + m),
      info: m => alert("ℹ " + m),
      warning: m => alert("" + m),
    };
  }
  return ctx;
}