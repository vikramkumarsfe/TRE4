import type { Config } from "tailwindcss";
export default { content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"], theme: { extend: { colors: { ink: "#152422", forest: "#146b55", mint: "#eaf5ef", paper: "#f6f8f5", muted: "#718078" }, boxShadow: { soft: "0 8px 30px rgba(30, 58, 47, .06)" } } }, plugins: [] } satisfies Config;
