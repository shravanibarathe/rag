import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0f172a", // Deep navy
        foreground: "#f8fafc",
        primary: "#3b82f6", // Electric blue
        accent: "#10b981", // Emerald accent
        panel: "#1e293b",
        border: "#334155"
      },
    },
  },
  plugins: [],
};
export default config;
