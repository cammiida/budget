import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./app/lib/schema.ts",
  out: "./drizzle",
  driver: "d1",
  dbCredentials: {
    dbName: "budget --local", // TODO: change this when drizzle-kit studio command supports local flag
    wranglerConfigPath: `${process.cwd()}/wrangler.toml`,
  },
  verbose: true,
  strict: true,
});
