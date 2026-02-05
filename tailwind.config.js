/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        neon: "#00ff41",
        background: "#1a1a1a",
        card: "#242424",
        teams: {
          a: "#ff6b6b",
          b: "#4facfe",
          c: "#43e97b",
          d: "#fa709a",
          e: "#a8edea",
        },
      },
    },
  },
  plugins: [],
};
