const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;
const { createClient } = require('@libsql/client');

// Read .env.local for Turso Cloud credentials
const envPath = path.resolve(__dirname, '..', '.env.local');
let url = "libsql://raeed1-raydalslwy429-hue.aws-eu-central-1.turso.io";
let authToken = "";

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('TURSO_DATABASE_URL=')) {
      url = trimmed.split('=')[1].trim();
    } else if (trimmed.startsWith('TURSO_AUTH_TOKEN=')) {
      authToken = trimmed.split('=')[1].trim();
    }
  });
}

// Check internet connectivity to avoid hanging
async function isOnline() {
  try {
    const hostname = url.replace('libsql://', '').replace('https://', '').split('/')[0].split(':')[0];
    await Promise.race([
      dns.lookup(hostname),
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 3000))
    ]);
    return true;
  } catch (err) {
    return false;
  }
}

const baseDir = path.resolve(__dirname, '..', 'system_data');
const localDbPath = path.resolve(__dirname, '..', 'local.db');

function readJson(folder, filename) {
  const filePath = path.join(baseDir, folder, filename);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
    return null;
  }
}

async function upsertTableFromLocal(localClient, cloudClient, tableName) {
  try {
    const result = await localClient.execute(`SELECT * FROM ${tableName}`);
    const rows = result.rows;
    if (!rows || rows.length === 0) return 0;

    const columns = Object.keys(rows[0]);
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;

    let count = 0;
    for (const row of rows) {
      const values = columns.map(col => row[col]);
      await cloudClient.execute({ sql, args: values });
      count++;
    }
    return count;
  } catch (err) {
    console.warn(`⚠️ Warning syncing table ${tableName}:`, err.message);
    return 0;
  }
}

async function syncToCloud() {
  console.log("🌐 جارٍ التحقق من اتصال الإنترنت بالسحابة...");
  const online = await isOnline();
  if (!online) {
    console.error("❌ تعذر الاتصال بالسحابة: الجهاز غير متصل بالإنترنت حالياً (Offline).");
    console.error("💡 يرجى التأكد من تشغيل شبكة الإنترنت / الواي فاي على الجهاز ثم المحاولة مجدداً.");
    process.exit(1);
  }

  console.log("Connecting to Turso Cloud for Push:", url);
  const cloudClient = createClient({ url, authToken });

  console.log("🚀 Starting Push from system_data & local.db to Turso Cloud...");

  // 1. Departments
  const departments = readJson('03_departments', 'departments.json');
  if (Array.isArray(departments) && departments.length > 0) {
    console.log(`Pushing ${departments.length} departments...`);
    for (const d of departments) {
      if (!d.code || !d.name) continue;
      await cloudClient.execute({
        sql: "INSERT OR REPLACE INTO departments (id, code, name, status) VALUES (?, ?, ?, ?)",
        args: [d.id || null, d.code, d.name, d.status || 'active']
      });
    }
    console.log("✔ Departments synced successfully.");
  }

  // 2. Locations (Sections)
  const locations = readJson('03_departments', 'locations.json');
  if (Array.isArray(locations) && locations.length > 0) {
    console.log(`Pushing ${locations.length} locations/sections...`);
    for (const l of locations) {
      if (!l.code || !l.name) continue;
      await cloudClient.execute({
        sql: "INSERT OR REPLACE INTO locations (id, code, name, department_code, status) VALUES (?, ?, ?, ?, ?)",
        args: [l.id || null, l.code, l.name, l.department_code || '', l.status || 'active']
      });
    }
    console.log("✔ Locations/sections synced successfully.");
  }

  // 3. Custom Roles
  const roles = readJson('01_permissions', 'roles.json');
  if (Array.isArray(roles) && roles.length > 0) {
    console.log(`Pushing ${roles.length} custom roles...`);
    for (const r of roles) {
      if (!r.name) continue;
      const deptVal = typeof r.allowed_departments === 'object' ? JSON.stringify(r.allowed_departments) : (r.allowed_departments || 'all');
      const secVal = typeof r.allowed_sections === 'object' ? JSON.stringify(r.allowed_sections) : (r.allowed_sections || 'all');
      await cloudClient.execute({
        sql: `INSERT OR REPLACE INTO custom_roles (
          id, code, name, category, department_code, status, allowed_departments, allowed_sections, role_type, permissions_json, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          r.id || null,
          r.code || `crole_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          r.name,
          r.category || 'inspector',
          r.department_code || 'all',
          r.status || 'active',
          deptVal,
          secVal,
          r.role_type || r.category || 'inspector',
          typeof r.permissions_json === 'object' ? JSON.stringify(r.permissions_json) : (r.permissions_json || '{}'),
          r.description || ''
        ]
      });
    }
    console.log("✔ Custom roles synced successfully.");
  }

  // 4. Categories (Non-conformity cases)
  const categories = readJson('04_categories', 'categories.json');
  if (Array.isArray(categories) && categories.length > 0) {
    console.log(`Pushing ${categories.length} categories...`);
    for (const c of categories) {
      if (!c.code || !c.name) continue;
      await cloudClient.execute({
        sql: "INSERT OR REPLACE INTO categories (id, code, name, severity, department_code, section_code, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
        args: [c.id || null, c.code, c.name, c.severity || 'medium', c.department_code || 'all', c.section_code || 'all', c.status || 'active']
      });
    }
    console.log("✔ Categories synced successfully.");
  }

  // 5. Users
  const users = readJson('05_users', 'users.json');
  if (Array.isArray(users) && users.length > 0) {
    console.log(`Pushing ${users.length} users...`);
    for (const u of users) {
      if (!u.full_name || !u.pin_code) continue;
      // Protect super_admin
      const isProtected = (u.pin_code === "2222" || Number(u.id) === 1 || Number(u.is_protected) === 1) ? 1 : 0;
      await cloudClient.execute({
        sql: "INSERT OR REPLACE INTO users (id, user_number, full_name, pin_code, role, department_code, department_name, is_protected) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        args: [u.id || null, u.user_number || null, u.full_name, u.pin_code, u.role || 'field_agent', u.department_code || '', u.department_name || '', isProtected]
      });
    }
    console.log("✔ Users synced successfully.");
  }

  // 6. Forms Templates
  const forms = readJson('06_forms', 'forms_templates.json');
  if (Array.isArray(forms) && forms.length > 0) {
    console.log(`Pushing ${forms.length} forms templates...`);
    for (const f of forms) {
      if (!f.title) continue;
      await cloudClient.execute({
        sql: "INSERT OR REPLACE INTO forms_templates (id, code, title, description, allowed_roles, status) VALUES (?, ?, ?, ?, ?, ?)",
        args: [f.id || null, f.code || null, f.title, f.description || '', f.allowed_roles || 'all', f.status || 'active']
      });
    }
    console.log("✔ Forms templates synced successfully.");
  }

  // 7. Operational Data from local.db (Cases, Assignments, Executions, Decisions, Forms Responses, Audit Logs)
  if (fs.existsSync(localDbPath)) {
    console.log("📂 Local database detected (local.db). Syncing operational transactions to cloud...");
    const localClient = createClient({
      url: `file:${localDbPath.replace(/\\/g, '/')}`
    });

    const casesCount = await upsertTableFromLocal(localClient, cloudClient, 'cases_master');
    console.log(`✔ Synced ${casesCount} cases (cases_master) to cloud.`);

    const asgCount = await upsertTableFromLocal(localClient, cloudClient, 'case_assignments');
    console.log(`✔ Synced ${asgCount} assignments (case_assignments) to cloud.`);

    const execCount = await upsertTableFromLocal(localClient, cloudClient, 'case_executions');
    console.log(`✔ Synced ${execCount} executions (case_executions) to cloud.`);

    const decCount = await upsertTableFromLocal(localClient, cloudClient, 'admin_decisions');
    console.log(`✔ Synced ${decCount} admin decisions (admin_decisions) to cloud.`);

    const respCount = await upsertTableFromLocal(localClient, cloudClient, 'forms_responses');
    console.log(`✔ Synced ${respCount} form responses (forms_responses) to cloud.`);

    const ansCount = await upsertTableFromLocal(localClient, cloudClient, 'forms_answers');
    console.log(`✔ Synced ${ansCount} form answers (forms_answers) to cloud.`);

    const auditCount = await upsertTableFromLocal(localClient, cloudClient, 'audit_logs');
    console.log(`✔ Synced ${auditCount} audit logs (audit_logs) to cloud.`);
  }

  console.log("🎉 تمت المزامنة الشاملة لجميع الإعدادات والحالات والعمليات التشغيلية بنجاح إلى Turso Cloud!");
}

syncToCloud().catch(err => {
  console.error("❌ Sync error:", err);
  process.exit(1);
});
