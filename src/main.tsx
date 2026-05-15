import React from "react";
import ReactDOM from "react-dom/client";
import { installCapacitorDesktopApi } from "./platform/capacitorDesktopApi";
import { App } from "./ui/App";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import "./styles/global.css";

installCapacitorDesktopApi();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
