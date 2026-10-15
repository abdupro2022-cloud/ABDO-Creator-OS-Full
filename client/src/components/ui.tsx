import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";

export function Card({ children, title, action }: { children: ReactNode; title?: ReactNode; action?: ReactNode }) {
  return (
    <section
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        padding: 20,
        boxShadow: "var(--shadow-sm)",
        marginBottom: 16,
      }}
    >
      {title && (
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled = false,
  style,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  style?: React.CSSProperties;
  "aria-label"?: string;
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: {
      background: "var(--color-primary)",
      color: "white",
      border: "1px solid var(--color-primary)",
    },
    secondary: {
      background: "var(--color-cta)",
      color: "white",
      border: "1px solid var(--color-cta)",
    },
    ghost: {
      background: "transparent",
      color: "var(--color-text)",
      border: "1px solid var(--color-border)",
    },
    danger: {
      background: "transparent",
      color: "var(--color-error)",
      border: "1px solid var(--color-error)",
    },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        ...styles[variant],
        padding: "8px 14px",
        borderRadius: "var(--radius-sm)",
        fontSize: 14,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "background 150ms ease, border-color 150ms ease, color 150ms ease",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
  hint,
  error,
}: {
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <span style={{ display: "block", marginBottom: 6, fontSize: 13, color: "var(--color-text-muted)", fontWeight: 600 }}>{label}</span>
      {children}
      {hint && !error && <div style={{ fontSize: 12, color: "var(--color-text-faint)", marginTop: 4 }}>{hint}</div>}
      {error && <div style={{ fontSize: 12, color: "var(--color-error)", marginTop: 4 }} role="alert">{error}</div>}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        padding: "8px 10px",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--color-border-strong)",
        fontSize: 14,
        background: "var(--color-surface)",
        color: "var(--color-text)",
        ...(props.style ?? {}),
      }}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      style={{
        width: "100%",
        padding: "8px 10px",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--color-border-strong)",
        fontSize: 14,
        minHeight: 100,
        fontFamily: "inherit",
        background: "var(--color-surface)",
        color: "var(--color-text)",
        ...(props.style ?? {}),
      }}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select
      {...props}
      style={{
        width: "100%",
        padding: "8px 10px",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--color-border-strong)",
        fontSize: 14,
        background: "var(--color-surface)",
        color: "var(--color-text)",
        ...(props.style ?? {}),
      }}
    />
  );
}

export function EmptyState({ title, body, action }: { title: ReactNode; body?: ReactNode; action?: ReactNode }) {
  return (
    <div
      style={{
        padding: 32,
        textAlign: "center",
        border: "1px dashed var(--color-border)",
        borderRadius: "var(--radius-md)",
        background: "var(--color-surface-2)",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{title}</div>
      {body && <div style={{ color: "var(--color-text-muted)", fontSize: 14, marginBottom: 12 }}>{body}</div>}
      {action}
    </div>
  );
}

export function StatusPill({ tone, children }: { tone: "success" | "warning" | "error" | "muted"; children: ReactNode }) {
  const bg = tone === "success" ? "var(--color-success)"
    : tone === "warning" ? "var(--color-warning)"
    : tone === "error" ? "var(--color-error)"
    : "var(--color-text-faint)";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        background: bg,
        color: "white",
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div
      role="alert"
      style={{
        padding: 12,
        border: "1px solid var(--color-error)",
        background: "#fef2f2",
        color: "var(--color-error)",
        borderRadius: "var(--radius-sm)",
        fontSize: 14,
        marginBottom: 12,
      }}
    >
      {message}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>{title}</h1>
        {action}
      </div>
      {subtitle && <p style={{ color: "var(--color-text-muted)", marginTop: 4, fontSize: 14 }}>{subtitle}</p>}
    </header>
  );
}

export function useLoading(initial = false) {
  // tiny helper to standardize loading state names
  return { loading: initial };
}

export function Spinner() {
  return (
    <span
      aria-label="loading"
      style={{
        display: "inline-block",
        width: 14,
        height: 14,
        border: "2px solid var(--color-border-strong)",
        borderTopColor: "var(--color-primary)",
        borderRadius: "50%",
        animation: "abdo-spin 800ms linear infinite",
      }}
    >
      <style>{`@keyframes abdo-spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}

// touch-target helper
export const TAP_STYLE: React.CSSProperties = { minHeight: 44, minWidth: 44 };
