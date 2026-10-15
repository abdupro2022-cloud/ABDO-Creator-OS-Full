import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button, Card, ErrorBox, Field, TextInput } from "../components/ui";
import type { SessionUser } from "@abdo/shared";

export function SignUpPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setSession = useAuth((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.post<{ token: string; user: SessionUser }>("/auth/signup", { email, password, displayName: displayName || undefined });
      setSession(res.token, res.user);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign-up failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <h1 style={{ fontSize: 22, textAlign: "center", marginBottom: 16 }}>{t("app.title")}</h1>
        <Card title={t("auth.signUpTitle")}>
          <form onSubmit={onSubmit} noValidate>
            {error && <ErrorBox message={error} />}
            <Field label={t("common.email")}>
              <TextInput type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label={t("common.displayName")}>
              <TextInput autoComplete="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </Field>
            <Field label={t("common.password")} hint={t("auth.passwordHint")}>
              <TextInput type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Button type="submit" disabled={busy}>{t("auth.signUpCta")}</Button>
            <p style={{ marginTop: 12, fontSize: 13, color: "var(--color-text-muted)" }}>
              {t("auth.switchToSignIn")} <Link to="/signin">{t("common.signIn")}</Link>
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
