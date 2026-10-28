import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "maplibre-gl/dist/maplibre-gl.css";
import "./style.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
if (import.meta.env.PROD)
  window.addEventListener("load", () => {
    if (!("serviceWorker" in navigator)) {
      window.dispatchEvent(new Event("mildraw-offline-error"));
      return;
    }
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        const installing = registration.installing;
        installing?.addEventListener("statechange", () => {
          if (installing?.state === "redundant" && !registration.active)
            window.dispatchEvent(new Event("mildraw-offline-error"));
        });
        return navigator.serviceWorker.ready;
      })
      .then(() => window.dispatchEvent(new Event("mildraw-offline-ready")))
      .catch(() => window.dispatchEvent(new Event("mildraw-offline-error")));
  });
