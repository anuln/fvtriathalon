import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        html: "<!doctype html><html><body><div id='app'></div></body></html>"
      }
    }
  }
});
