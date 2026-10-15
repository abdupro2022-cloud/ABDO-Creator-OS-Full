import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams, Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { Button, Card, ErrorBox, Field, TextInput } from "../components/ui";

export function PasswordResetPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const initialToken = params.get("token") ?? "";
  const [email, setEmail] = useState("");
  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);

  const onRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setInfo(null); setBusy(true);
    try {
      const res = await api.post<{ ok: true; devToken?: string }>("/auth/recovery/request", { email });
      if (res.devToken) {
        setDevToken(res.devToken);
        setInfo("In dev mode the token is shown here. In production, an email is sent instead.");
      } else {
        setInfo("If that email is registered, a reset link has been sent.");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Request failed.");
    } finally { setBusy(false); }
  };

  const onReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setInfo(null); setBusy(true);
    try {
      await api.post("/auth/recovery/reset", { token, newPassword });
      setInfo("Password reset. You can now sign in.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Reset failed.");
    } finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 460 }}>
        <h1 style={{ fontSize: 20, textAlign: "center", marginBottom: 12 }}>{t("app.title")}</h1>
        {error && <ErrorBox message={error} />}
        {info && <div role="status" style={{ padding: 10, background: "#ecfdf5", color: "var(--color-success)", borderRadius: 6, marginBottom: 12 }}>{info}</div>}
        <Card title="Request a reset link">
          <form onSubmit={onRequest}>
            <Field label="Email"><TextInput type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Button type="submit" disabled={busy}>Request</Button>
          </form>
          {devToken && (
            <div style={{ marginTop: 12, padding: 8, background: "var(--color-surface-2)", borderRadius: 6, fontSize: 12, wordBreak: "break-all" }}>
              <strong>Dev token:</strong> {devToken}
            </div>
          )}
        </Card>
        <Card title="Reset with token">
          <form onSubmit={onReset}>
            <Field label="Token"><TextInput value={token} onChange={(e) => setToken(e.target.value)} required /></Field>
            <Field label="New password (min 8)"><TextInput type="password" minLength={8} required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></Field>
            <Button type="submit" disabled={busy}>Reset password</Button>
          </form>
        </Card>
        <p style={{ marginTop: 12, fontSize: 13, color: "var(--color-text-muted)", textAlign: "center" }}>
          <Link to="/signin">{t("common.signIn")}</Link>
        </p>
      </div>
    </div>
  );
}
