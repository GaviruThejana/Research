/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Calming medical color palette
        medical: {
          blue: {
            50: "#F0F7FF",
            100: "#E0EEFF",
            200: "#B8D9FF",
            300: "#8BC4FF",
            400: "#5FA9F0",
            500: "#3D8FE0",
            600: "#2B75C8",
            700: "#1F5BA8",
            800: "#174685",
            900: "#0F3362",
          },
          sage: {
            50: "#F5F8F5",
            100: "#E8F0E8",
            200: "#C5DBC5",
            300: "#9FC69F",
            400: "#78B278",
            500: "#5A9E5A",
            600: "#448644",
            700: "#366E36",
            800: "#2B562B",
            900: "#224422",
          },
          slate: {
            50: "#F8FAFC",
            100: "#F1F5F9",
            200: "#E2E8F0",
            300: "#CBD5E1",
            400: "#94A3B8",
            500: "#64748B",
            600: "#475569",
            700: "#334155",
            800: "#1E293B",
            900: "#0F172A",
          },
        },
        ink: {
          950: "#0A1620",
          900: "#0E1F2E",
          800: "#142B3D",
          700: "#1C3A50",
        },
        paper: {
          50: "#F6F8F9",
          100: "#EEF2F4",
          200: "#DDE5E9",
        },
        clinic: {
          teal: "#158A82",
          tealDark: "#0E655F",
          amber: "#C9862A",
          rose: "#B4463C",
          slate: "#5D7383",
        },
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        sans: ["'Inter'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 2px rgba(10, 22, 32, 0.06), 0 8px 24px rgba(10, 22, 32, 0.08)",
        "medical-soft": "0 4px 20px rgba(61, 143, 224, 0.1)",
        "sage-soft": "0 4px 20px rgba(90, 158, 90, 0.1)",
      },
      keyframes: {
        scanline: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        progress: {
          "0%": { width: "0%" },
        },
      },
      animation: {
        scanline: "scanline 1.8s ease-in-out infinite",
        fadeUp: "fadeUp 0.4s ease-out",
        progress: "progress 1s ease-out forwards",
      },
    },
  },
  plugins: [],
};
