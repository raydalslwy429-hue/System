const fs = require("fs");
const path = require("path");
const { createClient } = require("@libsql/client");
const XLSX = require("xlsx");

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

function parseKoboXLSForm(buffer, defaultTitle, defaultCode) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetNames = wb.SheetNames;
  const findSheet = (name) => {
    const found = sheetNames.find((s) => s.trim().toLowerCase() === name.toLowerCase());
    return found ? wb.Sheets[found] : null;
  };

  const surveySheet = findSheet("survey") || wb.Sheets[sheetNames[0]];
  const choicesSheet = findSheet("choices");
  const settingsSheet = findSheet("settings");

  let formTitle = defaultTitle || "استمارة Kobo";
  let formCode = defaultCode || `kobo_${Date.now()}`;
  let formDesc = "استمارة مستوردة ومحدثة بنظام XLSForm / Kobo القياسي";

  if (settingsSheet) {
    const settingsData = XLSX.utils.sheet_to_json(settingsSheet);
    if (settingsData.length > 0) {
      const s = settingsData[0];
      if (s.form_title || s["form_title::Arabic (ar)"]) {
        formTitle = String(s.form_title || s["form_title::Arabic (ar)"]).trim();
      }
      if (s.form_id || s.id_string) {
        if (!defaultCode) formCode = String(s.form_id || s.id_string).trim().toLowerCase().replace(/\s+/g, "_");
      }
      if (s.description) {
        formDesc = String(s.description).trim();
      }
    }
  }

  const choiceMap = new Map();
  if (choicesSheet) {
    const choicesData = XLSX.utils.sheet_to_json(choicesSheet);
    choicesData.forEach((c) => {
      const listName = String(c.list_name || c.listname || "").trim();
      if (!listName) return;

      const label = String(
        c.label ||
        c["label::Arabic (ar)"] ||
        c["label::العربية"] ||
        c["label::ar"] ||
        c["label::arabic"] ||
        c.name ||
        ""
      ).trim();

      if (label) {
        if (!choiceMap.has(listName)) {
          choiceMap.set(listName, []);
        }
        choiceMap.get(listName).push(label);
      }
    });
  }

  const surveyData = XLSX.utils.sheet_to_json(surveySheet);
  const questions = [];
  let currentStep = 1;
  let orderIndex = 1;

  const ignoreTypes = new Set([
    "start", "end", "today", "deviceid", "phonenumber", "username", "simserial", "subscriberid", "audit", "calculate"
  ]);

  for (const row of surveyData) {
    const rawType = String(row.type || "").trim();
    if (!rawType) continue;

    const lowerType = rawType.toLowerCase();

    if (lowerType === "begin_group" || lowerType === "begin group" || lowerType === "begin_repeat") {
      if (questions.some((q) => q.step_number === currentStep)) {
        currentStep++;
      }
      continue;
    }

    if (lowerType === "end_group" || lowerType === "end group" || lowerType === "end_repeat") {
      continue;
    }

    if (ignoreTypes.has(lowerType)) continue;

    const qName = String(row.name || `q_${orderIndex}`).trim();
    const qText = String(
      row.label ||
      row["label::Arabic (ar)"] ||
      row["label::العربية"] ||
      row["label::ar"] ||
      row["label::arabic"] ||
      qName
    ).trim();

    if (!qText || qText === "false") continue;

    const isRequired =
      String(row.required || "").trim().toLowerCase() === "true" ||
      String(row.required || "").trim() === "1" ||
      String(row.required || "").trim().toLowerCase() === "yes";

    const helpText = row.hint ? String(row.hint).trim() : undefined;

    let fieldType = "text";
    let options = undefined;

    if (lowerType.startsWith("select_one") || lowerType.startsWith("select one")) {
      const parts = rawType.split(/\s+/);
      const listName = parts[1]?.trim();
      options = listName ? choiceMap.get(listName) : undefined;
      fieldType = options && options.length <= 5 ? "radio" : "select";
    } else if (lowerType.startsWith("select_multiple") || lowerType.startsWith("select multiple")) {
      const parts = rawType.split(/\s+/);
      const listName = parts[1]?.trim();
      options = listName ? choiceMap.get(listName) : undefined;
      fieldType = "radio";
    } else if (lowerType === "integer" || lowerType === "decimal") {
      fieldType = "number";
    } else if (lowerType === "date") {
      fieldType = "date";
    } else if (lowerType === "time") {
      fieldType = "time";
    } else if (lowerType === "image" || lowerType === "photo") {
      fieldType = "image";
    } else if (lowerType === "geopoint") {
      fieldType = "gps";
    } else if (lowerType === "text") {
      const isMulti =
        String(row.appearance || "").includes("multiline") ||
        qText.includes("ملاحظات") ||
        qText.includes("وصف") ||
        qText.includes("توضيح");
      fieldType = isMulti ? "textarea" : "text";
    }

    questions.push({
      question_code: qName,
      question_text: qText,
      field_type: fieldType,
      is_required: isRequired,
      options,
      step_number: currentStep,
      order_index: orderIndex++,
      help_text: helpText,
      placeholder: options ? undefined : "أدخل القيمة...",
    });
  }

  return {
    code: formCode,
    title: formTitle,
    description: formDesc,
    questions,
    stepsCount: currentStep,
  };
}

async function syncToDb(client, clientName, parsed, allowedRoles, deptCode) {
  console.log(`[${clientName}] Syncing form: [${parsed.code}] ${parsed.title}...`);

  // Check if exists
  const existing = await client.execute({
    sql: "SELECT id FROM forms_templates WHERE code = ?",
    args: [parsed.code],
  });

  let templateId;
  if (existing.rows.length > 0) {
    templateId = Number(existing.rows[0].id);
    await client.execute({
      sql: `UPDATE forms_templates 
            SET title = ?, description = ?, allowed_roles = ?, department_code = ?, status = 'active'
            WHERE id = ?`,
      args: [parsed.title, parsed.description, allowedRoles, deptCode, templateId],
    });
    // Delete existing questions to re-seed accurately
    await client.execute({
      sql: "DELETE FROM form_questions WHERE template_id = ?",
      args: [templateId],
    });
  } else {
    const res = await client.execute({
      sql: `INSERT INTO forms_templates (code, title, description, allowed_roles, department_code, allowed_users_json, version, status)
            VALUES (?, ?, ?, ?, ?, 'all', 1, 'active')
            RETURNING id`,
      args: [parsed.code, parsed.title, parsed.description, allowedRoles, deptCode],
    });
    templateId = Number(res.rows[0].id);
  }

  // Insert Questions
  for (let idx = 0; idx < parsed.questions.length; idx++) {
    const q = parsed.questions[idx];
    await client.execute({
      sql: `INSERT INTO form_questions (
        template_id, question_code, question_text, field_type, is_required,
        options_json, conditional_logic_json, step_number, order_index, help_text, placeholder
      ) VALUES (?, ?, ?, ?, ?, ?, null, ?, ?, ?, ?)`,
      args: [
        templateId,
        q.question_code,
        q.question_text,
        q.field_type,
        q.is_required ? 1 : 0,
        q.options ? JSON.stringify(q.options) : null,
        q.step_number,
        idx + 1,
        q.help_text || null,
        q.placeholder || null,
      ],
    });
  }

  console.log(`[${clientName}] Successfully synced (${parsed.questions.length}) questions across (${parsed.stepsCount}) steps for template #${templateId}.`);
}

async function main() {
  const folder = "C:\\Users\\مطعم المراسيم\\.gemini\\antigravity\\brain\\c6b6b151-e06d-4061-8c1a-34161e97a8a9\\.user_uploaded";

  // 1. استمارة التفتيش والرقابة على الصالات وجودة الخدمة (Excel)
  const hallFile = path.join(folder, "media_1794796450097_e3f0f3ad.xlsx");
  const hallBuf = fs.readFileSync(hallFile);
  const hallParsed = parseKoboXLSForm(
    hallBuf,
    "استمارة التفتيش والرقابة على الصالات وجودة الخدمة",
    "hall_quality_inspection"
  );
  hallParsed.description = "الاستمارة المعيارية الشاملة لتقييم صالات المراسيم وسرعة الاستقبال ودقة الطلبات وجودة الخدمة";

  // 2. استمارة التقرير اليومي وحصر المشاكل والإنحرافات
  const incFile = path.join(folder, "media_1794797091690_7b2b38dd.xlsx");
  const incBuf = fs.readFileSync(incFile);
  const incParsed = parseKoboXLSForm(
    incBuf,
    "استمارة التقرير اليومي وحصر المشاكل والإنحرافات",
    "daily_incident_report"
  );
  incParsed.description = "توثيق وحصر بلاغات الانحرافات والمشاكل التشغيلية اليومية بالأقسام والمطابخ والصالات";

  console.log("=== Syncing to Local DB ===");
  await syncToDb(localClient, "Local DB", hallParsed, "inspector,admin,super_admin", "halls");
  await syncToDb(localClient, "Local DB", incParsed, "inspector,field_agent,admin,super_admin", "all");

  console.log("\n=== Syncing to Cloud Turso DB ===");
  await syncToDb(cloudClient, "Cloud Turso", hallParsed, "inspector,admin,super_admin", "halls");
  await syncToDb(cloudClient, "Cloud Turso", incParsed, "inspector,field_agent,admin,super_admin", "all");

  console.log("\n✅ All Kobo Forms Synchronized with Accurate XLSForm Choices and Types!");
}

main().catch(console.error);
