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
        brand: {
          orange: "#FF5900",
          "orange-hover": "#FF6B18",
          "orange-active": "#FF3D00",
          dark: "#15191E",
          navy: "#000710",
        },
        gray: {
          100: "#F3F3F7",
          300: "#B9BBC6",
          500: "#6F737B",
          600: "#60646C",
          900: "#15191E",
        },
        status: {
          success: "#44C67F",
          warning: "#FF9500",
          critical: "#FF3D00",
          info: "#3784F4",
        },
      },
      borderRadius: {
        DEFAULT: "10px",
        card: "12px",
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
      letterSpacing: {
        hero: "-0.96px",
        h2: "-0.64px",
        h3: "-0.40px",
        heading: "-0.28px",
        eyebrow: "0.08em",
      },
      boxShadow: {
        card: "0 4px 16px rgba(0,0,0,0.08)",
        "card-hover": "0 4px 16px rgba(0,0,0,0.12)",
        "orange-glow": "0 4px 12px rgba(255,89,0,0.3)",
      },
      maxWidth: {
        content: "1280px",
      },
    },
  },
  plugins: [],
};

export default config;
