import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Warm parchment palette — feels like a serious tool, not a SaaS landing
        paper: "#FAF8F3",
        surface: "#FFFFFF",
        ink: "#1A1814",
        muted: "#6B6357",
        rule: "#E8E2D5",
        cream: "#F5EBD9",
        // Signal colors — used SPARINGLY. One job each.
        urgent: "#C2410C",     // terracotta — Buy Box lost, action available
        urgentBg: "#FDF1E8",
        healthy: "#3F6212",    // deep olive — Buy Box won
        healthyBg: "#F0F4E6",
        blocked: "#52525B",    // slate — monitoring only
        blockedBg: "#F4F4F5",
      },
      fontFamily: {
        // Sans for UI chrome
        sans: ["var(--font-instrument-sans)", "system-ui", "sans-serif"],
        // Serif for AI recommendation sentences — gives them verdict-like weight
        serif: ["var(--font-fraunces)", "Georgia", "serif"],
        // Mono for prices — money should feel precise, not playful
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(26, 24, 20, 0.04), 0 0 0 1px rgba(26, 24, 20, 0.05)",
        cardHover: "0 4px 12px -2px rgba(26, 24, 20, 0.08), 0 0 0 1px rgba(26, 24, 20, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
