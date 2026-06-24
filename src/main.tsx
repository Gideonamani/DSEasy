import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { registerChartJS } from "./lib/chartRegistry";

registerChartJS();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error('Root element "#root" not found in document');
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter unstable_useTransitions={false}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SettingsProvider>
            <App />
          </SettingsProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
);
