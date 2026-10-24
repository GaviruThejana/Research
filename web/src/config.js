/**
 * Base URL of the Node API (the app's only backend; it forwards predictions
 * to FastAPI). Empty = same origin: requests go to /api/... and the Vite dev
 * server proxies them (see vite.config.js). Set VITE_NODE_API_URL only when
 * the web app is served without that proxy.
 */
export const NODE_API_URL = (import.meta.env.VITE_NODE_API_URL || "").replace(/\/+$/, "");
