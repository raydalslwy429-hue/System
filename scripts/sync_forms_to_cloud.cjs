const fs = require("fs");
const path = require("path");
const { createClient } = require("@libsql/client");

const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env.local");

function readEnv(file) {
  const res = {};
  if (!fs.existsSync(file)) return res;
  fs.readFileSync(file, "utf8").split(/\r?\n/).forEach(line => {
    const idx = line.indexOf("=");
    if (idx > 0) {
      let val = line.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      res[line.slice(0, idx).trim()] = val;
    }
  });
  return res;
}

const env = readEnv(envPath);
const localClient = createClient({ url: `file:${path.join(root, "local.db").replace(/\\/g, "/")}` });
const cloudClient = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });

async function syncTable(table) {
  console.log(`Syncing ${table}...`);
  const localRows = await localClient.execute(`SELECT * FROM ${table}`);
  console.log(`  Local count: ${localRows.rows.length}`);
  
  // Clear cloud table
  await cloudClient.execute(`DELETE FROM ${table}`);

  if (localRows.rows.length === 0) return;

  const cols = localRows.columns;
  const placeholders = cols.map(() => "?").join(", ");
  const colNames = cols.map(c => `"${c}"`).join(", ");
  const sql = `INSERT INTO ${table} (${colNames}) VALUES (${placeholders})`;

  const chunkSize = 25;
  for (let i = 0; i < localRows.rows.length; i += chunkSize) {
    const batch = localRows.rows.slice(i, i + chunkSize);
    const statements = batch.map(row => ({
      sql,
      args: cols.map(c => row[c] ?? null)
    }));
    await cloudClient.batch(statements, "write");
    process.stdout.write(`  Synced ${Math.min(i + chunkSize, localRows.rows.length)} / ${localRows.rows.length}\r`);
  }
  console.log(`\n  Finished ${table}!`);
}

async function main() {
  await syncTable("forms_templates");
  await syncTable("form_questions");
  await syncTable("lookup_employees");
  console.log("\n==> Cloud Sync for Forms & Staff completed successfully!");
}

main().catch(err => {
  console.error("Error during sync:", err.message);
});
