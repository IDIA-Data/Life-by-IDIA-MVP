import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  // Use a relative base to ensure the native WKWebView finds assets locally
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false, // Disable for production stabilization
    rollupOptions: {
      output: {
        // SURGICAL FIX: Vite 8 / Rolldown requires a function, not an object.
        // This isolates React and Lucide into a vendor chunk to prevent iOS crashes.
        manualChunks(id) {
          if (
            id.includes('node_modules/react') || 
            id.includes('node_modules/react-dom') || 
            id.includes('node_modules/lucide-react')
          ) {
            return 'vendor';
          }
        }
      },
    },
  },
});