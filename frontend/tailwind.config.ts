import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        brand: "#4f46e5",
        field: "#0f9f83"
      }
    }
  },
  plugins: []
};

export default config;
