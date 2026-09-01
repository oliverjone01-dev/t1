import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Сайт живёт по адресу <user>.github.io/t1/phoenix/, поэтому база фиксированная.
export default defineConfig({
  base: "/t1/phoenix/",
  plugins: [react()],
  build: { outDir: "dist", assetsDir: "a", sourcemap: false },
});
