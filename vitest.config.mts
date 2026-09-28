import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // integration tests talk to a real Supabase API and share one database
    fileParallelism: false,
  },
});
