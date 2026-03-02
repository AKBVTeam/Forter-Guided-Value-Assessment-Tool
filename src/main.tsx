import React from "react";
import { createRoot } from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App.tsx";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import "./index.css";

function renderApp() {
  // Only wrap with GoogleOAuthProvider when client ID is set. Empty clientId can cause a white screen.
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || "";
  const rootEl = document.getElementById("root");
  if (!rootEl) {
    document.body.innerHTML = "<div style='padding:2rem;font-family:system-ui'><h1>Error</h1><p>Root element #root not found.</p></div>";
    return;
  }

  const app = <App />;
  const wrappedApp = googleClientId ? (
    <GoogleOAuthProvider clientId={googleClientId}>{app}</GoogleOAuthProvider>
  ) : (
    app
  );

  createRoot(rootEl).render(
    <React.StrictMode>
      <AppErrorBoundary>
        {wrappedApp}
      </AppErrorBoundary>
    </React.StrictMode>
  );
}

try {
  renderApp();
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : "";
  console.error("App bootstrap error:", err);
  document.body.innerHTML = [
    "<div style='padding:2rem;font-family:system-ui;max-width:36rem'>",
    "<h1>App failed to load</h1>",
    "<p style='color:#666'>" + escapeHtml(msg) + "</p>",
    "<pre style='font-size:12px;overflow:auto;background:#f5f5f5;padding:1rem;border-radius:6px'>" + escapeHtml(stack || "No stack") + "</pre>",
    "</div>",
  ].join("");
}

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}
