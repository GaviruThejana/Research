import React from "react";
import ReactDOM from "react-dom/client";
// Inter, self-hosted (no request to a font CDN; works offline on the LAN).
import "@fontsource-variable/inter";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
