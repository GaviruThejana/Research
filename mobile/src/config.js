// Expo inlines EXPO_PUBLIC_* variables at build time (see mobile/.env.example).
// A phone can't reach "localhost" on your PC: use the PC's LAN IP instead.

/**
 * The Node API: the app's only backend. AI predictions also go through it
 * (POST /api/predictions), so the phone never talks to FastAPI directly.
 */
export const NODE_API_URL = (process.env.EXPO_PUBLIC_NODE_API_URL || "http://localhost:5000").replace(/\/+$/, "");
