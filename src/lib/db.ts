import { createClient, InStatement } from "@libsql/client";
import path from "path";
import fs from "fs";

type LibSqlClient = ReturnType<typeof createClient>;

let cachedClient: LibSqlClient | null = null;
let cachedMode: string | undefined = undefined;

const DEFAULT_TURSO_URL = "libsql://raeed1-raydalslwy429-hue.aws-eu-central-1.turso.io";
const DEFAULT_TURSO_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTQwNzUxNTcsImlkIjoiMDFhMWI3MzQtYmMwMS03ZjdmLWI1NTMtNGJlMzgyODkxZjU0Iiwia2lkIjoickV4c243NFRvQ2plQlBjeDMzRWcyM0pQT3JXdGZvaWZiYnpDcnVVY0dTZyIsInJpZCI6IjhmYjJlYzc0LThmYzctNGNjMy04MjFkLWQxNTY0ODViNDkxNiJ9.JixENvIVwegjJ2ZVr4nW5it2oNAma6D4UmV5JYy8R00Tf0oh_qt3d9oolBdrB5YVWijpIeflHG9CyO1JXqjoDw";

export function getPersistedDatabaseMode(): "local" | "cloud" {
  // Always force cloud mode on Vercel / serverless deployments
  if (process.env.VERCEL || process.env.NEXT_PUBLIC_VERCEL_ENV) {
    return "cloud";
  }
  try {
    const configPath = path.resolve(process.cwd(), "system_mode.json");
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (data.mode === "local" || data.mode === "cloud") {
        return data.mode;
      }
    }
  } catch {}
  return (process.env.DATABASE_MODE as "local" | "cloud") || "local";
}

export function setPersistedDatabaseMode(mode: "local" | "cloud") {
  try {
    const configPath = path.resolve(process.cwd(), "system_mode.json");
    fs.writeFileSync(configPath, JSON.stringify({ mode, updatedAt: new Date().toISOString() }, null, 2), "utf-8");
  } catch {}
  process.env.DATABASE_MODE = mode;
  cachedClient = null;
  cachedMode = undefined;
}

export function resetDbClient() {
  cachedClient = null;
  cachedMode = undefined;
}

export function getClient(): LibSqlClient {
  const currentMode = getPersistedDatabaseMode();
  if (cachedClient && cachedMode === currentMode) {
    return cachedClient;
  }

  const isLocal = currentMode === "local";
  const localDbUrl = `file:${path.resolve(process.cwd(), "local.db").replace(/\\/g, "/")}`;

  const url = isLocal
    ? localDbUrl
    : (process.env.TURSO_DATABASE_URL || DEFAULT_TURSO_URL);

  const authToken = isLocal ? undefined : (process.env.TURSO_AUTH_TOKEN || DEFAULT_TURSO_TOKEN);

  cachedClient = createClient({
    url,
    authToken,
  });
  cachedMode = currentMode;
  return cachedClient;
}

export const db = {
  async execute(stmt: InStatement) {
    const client = getClient();
    return await client.execute(stmt);
  },
  async batch(stmts: InStatement[], mode?: any) {
    const client = getClient();
    return await client.batch(stmts, mode);
  },
};
