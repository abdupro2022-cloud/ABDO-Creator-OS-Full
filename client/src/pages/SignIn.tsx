import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button, Card, ErrorBox, Field, TextInput } from "../components/ui";
import { setLanguage } from "../i18n";
import type { SessionUser } from "@abdo/shared";

export function SignInPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const setSession = useAuth((s) => s.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.post<{ token: string; user: SessionUser }>("/auth/signin", { email, password });
      setSession(res.token, res.user);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <h1 style={{ fontSize: 22 }}>{t("app.title")}</h1>
          <button
            type="button"
            onClick={() => setLanguage(i18n.language === "ar" ? "en" : "ar")}
            style={{ background: "transparent", border: "1px solid var(--color-border)", borderRadius: 6, padding: "4px 8px", color: "var(--color-text)" }}
          >
            {i18n.language === "ar" ? t("common.english") : t("common.arabic")}
          </button>
        </div>
        <Card title={t("auth.signInTitle")}>
          <form onSubmit={onSubmit} noValidate>
            {error && <ErrorBox message={error} />}
            <Field label={t("common.email")}>
              <TextInput type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label={t("common.password")}>
              <TextInput type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Button type="submit" disabled={busy}>{t("auth.signInCta")}</Button>
            <p style={{ marginTop: 12, fontSize: 13, color: "var(--color-text-muted)" }}>
              <Link to="/reset-password">Forgot password?</Link>
            </p>
            <p style={{ marginTop: 12, fontSize: 13, color: "var(--color-text-muted)" }}>
              {t("auth.switchToSignUp")} <Link to="/signup">{t("common.signUp")}</Link>
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
