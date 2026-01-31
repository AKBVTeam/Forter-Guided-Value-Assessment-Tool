import React from "react";

interface AppErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

/**
 * Global error boundary. Catches JavaScript errors in the component tree
 * and shows a fallback UI instead of a white screen.
 */
export class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("AppErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const isDev = import.meta.env.DEV;
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            fontFamily: "system-ui, sans-serif",
            background: "hsl(0 0% 98%)",
            color: "hsl(222 47% 11%)",
          }}
        >
          <div
            style={{
              maxWidth: "32rem",
              textAlign: "center",
            }}
          >
            <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
              Something went wrong
            </h1>
            <p style={{ color: "hsl(215 16% 47%)", marginBottom: "1.5rem" }}>
              The app encountered an error. Try refreshing the page. If the problem
              continues, try clearing this site’s data or use a different browser.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: "0.5rem 1rem",
                fontSize: "1rem",
                borderRadius: "0.5rem",
                border: "1px solid hsl(214 32% 91%)",
                background: "hsl(0 0% 100%)",
                cursor: "pointer",
              }}
            >
              Reload page
            </button>
            {isDev && this.state.error && (
              <details
                style={{
                  marginTop: "1.5rem",
                  textAlign: "left",
                  padding: "1rem",
                  background: "hsl(0 0% 94%)",
                  borderRadius: "0.5rem",
                  fontSize: "0.875rem",
                }}
              >
                <summary style={{ cursor: "pointer" }}>Error details (dev only)</summary>
                <pre
                  style={{
                    marginTop: "0.5rem",
                    overflow: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {this.state.error.toString()}
                  {"\n\n"}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
