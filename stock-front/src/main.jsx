import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "react-hot-toast";
import App from "./App";
import ErrorBoundary from "./components/ui/ErrorBoundary";
import { ConnectivityProvider } from "./store/ConnectivityContext";
import { AuthProvider } from "./store/AuthContext";
import { StoreProvider } from "./store/StoreContext";
import { ConfirmProvider } from "./components/ui/Confirm";
import "./index.css";

// Réseau (mode hors ligne) → session (utilisateur + entreprise) → données de l'entreprise
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ConnectivityProvider>
        <AuthProvider>
          <StoreProvider>
            <ConfirmProvider>
              <App />
              <Toaster
                position="top-right"
                gutter={10}
                toastOptions={{
                  duration: 3500,
                  style: {
                    borderRadius: "14px",
                    background: "#0f172a",
                    color: "#f8fafc",
                    fontSize: "13px",
                    fontWeight: 500,
                    padding: "10px 14px",
                    boxShadow: "0 12px 32px -8px rgb(15 23 42 / 0.35)",
                  },
                  success: { iconTheme: { primary: "#34d399", secondary: "#0f172a" } },
                  error: { iconTheme: { primary: "#fb7185", secondary: "#0f172a" } },
                }}
              />
            </ConfirmProvider>
          </StoreProvider>
        </AuthProvider>
      </ConnectivityProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
