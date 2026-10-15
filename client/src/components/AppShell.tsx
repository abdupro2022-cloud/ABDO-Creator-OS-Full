import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { useAuth } from "../lib/auth";
import { setLanguage } from "../i18n";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut, hydrated } = useAuth();

  useEffect(() => {
    useAuth.getState().hydrate();
  }, []);

  useEffect(() => {
    if (hydrated && !user) {
      const allowed = ["/signin", "/signup"];
      if (!allowed.includes(location.pathname)) navigate("/signin", { replace: true });
    }
    if (hydrated && user && (location.pathname === "/signin" || location.pathname === "/signup")) {
      navigate("/", { replace: true });
    }
  }, [hydrated, user, location.pathname, navigate]);

  if (!hydrated) {
    return <div style={{ padding: 32 }}>{t("common.loading")}</div>;
  }
  if (!user) {
    return <div style={{ padding: 32 }}>{children}</div>;
  }

  const nav = [
    { to: "/", label: t("nav.home") },
    { to: "/assistant", label: t("nav.assistant") },
    { to: "/workflows", label: t("nav.workflows") },
    { to: "/projects", label: t("nav.projects") },
    { to: "/research", label: t("nav.research") },
    { to: "/youtube", label: "YouTube" },
    { to: "/scripts", label: t("nav.scriptStudio") },
    { to: "/tools", label: t("nav.tools") },
    { to: "/skills", label: t("nav.skills") },
    { to: "/community", label: t("nav.community") },
    { to: "/providers", label: t("nav.providers") },
    { to: "/usage", label: t("nav.usage") },
    { to: "/help", label: t("nav.help") },
    { to: "/settings", label: t("nav.settings") },
  ];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 20px",
          background: "var(--color-surface)",
          borderBottom: "1px solid var(--color-border)",
          position: "sticky",
          top: 0,
          zIndex: "var(--z-base)" as unknown as number,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link to="/" style={{ fontFamily: "var(--font-heading)", fontWeight: 700, color: "var(--color-text)", textDecoration: "none" }}>
            {t("app.title")}
          </Link>
          <nav style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === "/"}
                style={({ isActive }) => ({
                  color: isActive ? "var(--color-primary)" : "var(--color-text-muted)",
                  fontWeight: isActive ? 600 : 500,
                  textDecoration: "none",
                  fontSize: 14,
                })}
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={() => setLanguage(i18n.language === "ar" ? "en" : "ar")}
            aria-label={t("common.language")}
            style={{
              padding: "6px 10px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-border)",
              background: "var(--color-surface-2)",
              color: "var(--color-text)",
              fontSize: 13,
            }}
          >
            {i18n.language === "ar" ? t("common.english") : t("common.arabic")}
          </button>
          <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>{user.email}</span>
          <button
            type="button"
            onClick={async () => {
              await signOut();
              navigate("/signin");
            }}
            style={{
              padding: "6px 10px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-border)",
              background: "transparent",
              color: "var(--color-text)",
              fontSize: 13,
            }}
          >
            {t("common.signOut")}
          </button>
        </div>
      </header>
      <main style={{ flex: 1, padding: 24, maxWidth: 1100, width: "100%", margin: "0 auto" }}>{children}</main>
    </div>
  );
}
