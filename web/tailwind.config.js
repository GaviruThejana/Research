/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      /*
       * Clinical palette. Every text/background pair used in the app meets
       * WCAG 2.1 AA (4.5:1 for body text), e.g.
       *   muted #475569 on canvas #F8FAFC   7.2:1
       *   white on primary #2563EB          5.2:1
       *   amber #92400E on amber-soft       6.8:1  (Moderate risk badge)
       *   rose  #B91C1C on rose-soft        5.9:1  (High risk / errors)
       *   sage  #047857 on sage-soft        5.2:1  (Low risk / approved)
       */
      colors: {
        ink: "#0F172A", // headings & body text (slate-900)
        muted: "#475569", // secondary text (slate-600)
        primary: {
          DEFAULT: "#2563EB", // blue-600: primary actions, links
          dark: "#1D4ED8", // blue-700: hover
          deep: "#1E3A8A", // blue-900: brand panel, strong headings
          soft: "#EFF6FF", // blue-50: tints, selected states
        },
        accent: { DEFAULT: "#0F766E", soft: "#F0FDFA" }, // teal-700 / teal-50
        rose: { DEFAULT: "#B91C1C", soft: "#FEF2F2" },
        amber: { DEFAULT: "#92400E", soft: "#FFFBEB" },
        sage: { DEFAULT: "#047857", soft: "#ECFDF5" },
        line: "#E2E8F0", // borders (slate-200)
        surface: "#FFFFFF",
        canvas: "#F8FAFC", // page background (slate-50)
        subtle: "#F1F5F9", // hover / placeholder fills (slate-100)
      },
      fontFamily: {
        sans: ['"Inter Variable"', "Inter", "system-ui", "-apple-system", '"Segoe UI"', "Roboto", "sans-serif"],
      },
      maxWidth: {
        app: "32rem",
        content: "48rem", // patient & doctor pages
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)",
        lift: "0 4px 12px rgba(15, 23, 42, 0.08), 0 2px 4px rgba(15, 23, 42, 0.04)",
      },
      keyframes: {
        shimmer: { "100%": { transform: "translateX(100%)" } },
        "fade-in": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "none" } },
        scan: { "0%, 100%": { top: "6%" }, "50%": { top: "94%" } },
      },
      animation: {
        shimmer: "shimmer 1.6s infinite",
        "fade-in": "fade-in 0.2s ease-out",
        scan: "scan 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
