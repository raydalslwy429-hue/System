const path = require("path");
const { createClient } = require("@libsql/client");
const localClient = createClient({ url: `file:${path.resolve(__dirname, "..", "local.db").replace(/\\/g, "/")}` });

async function checkCols() {
  const usersCols = await localClient.execute("PRAGMA table_info('users')");
  console.log("users cols:", usersCols.rows.map(r => r.name));
  const casesCols = await localClient.execute("PRAGMA table_info('cases_master')");
  console.log("cases_master cols:", casesCols.rows.map(r => r.name));
  const execCols = await localClient.execute("PRAGMA table_info('case_executions')");
  console.log("case_executions cols:", execCols.rows.map(r => r.name));
}
checkCols().catch(console.error);
