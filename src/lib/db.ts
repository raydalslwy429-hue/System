import { createClient, InStatement } from "@libsql/client";
import path from "path";

type LibSqlClient = ReturnType<typeof createClient>;

let cachedClient: LibSqlClient | null = null;
let cachedMode: string | undefined = undefined;

export function getClient(): LibSqlClient {
  const currentMode = process.env.DATABASE_MODE || "cloud";
  if (cachedClient && cachedMode === currentMode) {
    return cachedClient;
  }

  const isLocal = currentMode === "local";
  const localDbUrl = `file:${path.resolve(process.cwd(), "local.db").replace(/\\/g, "/")}`;

  const url = isLocal
    ? localDbUrl
    : (process.env.TURSO_DATABASE_URL || "libsql://raeed1-raydalslwy429-hue.aws-eu-central-1.turso.io");

  const authToken = isLocal ? undefined : (process.env.TURSO_AUTH_TOKEN || "");

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
