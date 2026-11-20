const path = require("path");
const fs = require("fs");
const { createClient } = require("@libsql/client");

const projectDir = path.resolve(__dirname, "..");
const envPath = path.join(projectDir, ".env.local");

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
const localClient = createClient({ url: `file:${path.join(projectDir, "local.db").replace(/\\/g, "/")}` });
const cloudClient = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });

async function addColumnIfNotExists(client, clientName, table, column, colDefinition) {
  try {
    const info = await client.execute(`PRAGMA table_info('${table}')`);
    const cols = info.rows.map(r => r.name);
    if (!cols.includes(column)) {
      console.log(`[${clientName}] Adding column ${column} to table ${table}...`);
      await client.execute(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${colDefinition}`);
      console.log(`[${clientName}] Successfully added ${column}.`);
    } else {
      console.log(`[${clientName}] Column ${column} already exists in ${table}.`);
    }
  } catch (err) {
    console.error(`[${clientName}] Error adding ${column} to ${table}:`, err.message);
  }
}

async function migrate(client, clientName) {
  console.log(`\n=== Running Migration on ${clientName} ===`);
  
  // 1. users table
  await addColumnIfNotExists(client, clientName, "users", "can_receive_cases", "INTEGER DEFAULT 0");
  await addColumnIfNotExists(client, clientName, "users", "can_close_assigned_cases", "INTEGER DEFAULT 0");
  await addColumnIfNotExists(client, clientName, "users", "home_department_code", "TEXT");
  await addColumnIfNotExists(client, clientName, "users", "home_section_code", "TEXT");
  await addColumnIfNotExists(client, clientName, "users", "supervised_departments", "TEXT DEFAULT 'all'");

  // Update existing field_agent roles to have can_receive_cases = 1 by default
  await client.execute("UPDATE users SET can_receive_cases = 1 WHERE role = 'field_agent' AND (can_receive_cases IS NULL OR can_receive_cases = 0)");

  // 2. cases_master table
  await addColumnIfNotExists(client, clientName, "cases_master", "photo_before", "TEXT");
  await addColumnIfNotExists(client, clientName, "cases_master", "hidden_fields_json", "TEXT");
  await addColumnIfNotExists(client, clientName, "cases_master", "curated_admin_instructions", "TEXT");

  // 3. case_executions table
  await addColumnIfNotExists(client, clientName, "case_executions", "photo_after", "TEXT");

  console.log(`=== Migration Finished on ${clientName} ===\n`);
}

async function main() {
  await migrate(localClient, "Local SQLite (local.db)");
  await migrate(cloudClient, "Cloud Turso");
  console.log("==> Phase 1 Database Migration Completed Successfully on both Local & Cloud!");
}

main().catch(err => {
  console.error("FATAL ERROR IN MIGRATION:", err);
  process.exit(1);
});
