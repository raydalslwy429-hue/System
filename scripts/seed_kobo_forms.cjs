const path = require("path");
const fs = require("fs");
const projectDir = path.resolve(__dirname, "..");
const { createClient } = require(path.join(projectDir, "node_modules/@libsql/client"));

const client = createClient({
  url: `file:${path.resolve(projectDir, "local.db").replace(/\\/g, "/")}`
});

const csvFile = "C:/Users/مطعم المراسيم/.gemini/antigravity/brain/c6b6b151-e06d-4061-8c1a-34161e97a8a9/.user_uploaded/media_1794797167266_779c6400.csv";

async function main() {
  console.log("==> Initializing lookup_employees table...");
  await client.execute(`
    CREATE TABLE IF NOT EXISTS lookup_employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      emp_no TEXT,
      full_name TEXT NOT NULL,
      supervisor_name TEXT,
      job_title TEXT,
      department TEXT,
      group_name TEXT,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Parse employees from CSV
  const employeesList = [];
  const employeeOptions = [];
  if (fs.existsSync(csvFile)) {
    const rawCsv = fs.readFileSync(csvFile, "utf8");
    const lines = rawCsv.split(/\r?\n/).filter(l => l.trim().length > 0);
    console.log(`Found ${lines.length} lines in lookup_employees.csv`);
    
    // Clear existing
    await client.execute("DELETE FROM lookup_employees");

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(",").map(p => p.trim());
      const rawName = parts[0]?.replace(/^[\uFEFF\s]+/, "");
      const empNo = parts[1] || parts[3] || "";
      const supName = parts[4] || "";
      const job = parts[7] || "";
      const dept = parts[8] || "";
      const group = parts[10] || "";
      const phone = parts[11] || "";

      if (rawName && rawName !== "(فارغ)" && rawName !== "null") {
        employeesList.push({ empNo, rawName, supName, job, dept, group, phone });
        employeeOptions.push(`${rawName} - ${job || "موظف"} (${group || dept || ""})`);
        
        await client.execute({
          sql: `INSERT INTO lookup_employees (emp_no, full_name, supervisor_name, job_title, department, group_name, phone)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [empNo, rawName, supName, job, dept, group, phone]
        });
      }
    }
    console.log(`Successfully seeded ${employeesList.length} employees into lookup_employees table.`);
  }

  // Helper to upsert template
  async function upsertTemplate(code, title, desc, allowedRoles, deptCode, questions) {
    console.log(`\n==> Upserting Template: [${code}] ${title}`);
    const existing = await client.execute({
      sql: "SELECT id FROM forms_templates WHERE code = ?",
      args: [code]
    });

    let templateId;
    if (existing.rows.length > 0) {
      templateId = Number(existing.rows[0].id);
      await client.execute({
        sql: `UPDATE forms_templates 
              SET title = ?, description = ?, allowed_roles = ?, department_code = ?, status = 'active'
              WHERE id = ?`,
        args: [title, desc, allowedRoles, deptCode, templateId]
      });
      // Delete old questions to re-seed cleanly
      await client.execute({
        sql: "DELETE FROM form_questions WHERE template_id = ?",
        args: [templateId]
      });
      console.log(`Updated template ID: ${templateId}`);
    } else {
      const res = await client.execute({
        sql: `INSERT INTO forms_templates (code, title, description, allowed_roles, department_code, status, version)
              VALUES (?, ?, ?, ?, ?, 'active', 1)
              RETURNING id`,
        args: [code, title, desc, allowedRoles, deptCode]
      });
      templateId = Number(res.rows[0].id);
      console.log(`Created template ID: ${templateId}`);
    }

    // Insert questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await client.execute({
        sql: `INSERT INTO form_questions (
          template_id, question_code, question_text, field_type, is_required,
          options_json, conditional_logic_json, step_number, order_index, help_text, placeholder
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          templateId,
          q.code,
          q.text,
          q.type,
          q.required ? 1 : 0,
          q.options ? JSON.stringify(q.options) : null,
          q.logic ? JSON.stringify(q.logic) : null,
          q.step || 1,
          i + 1,
          q.help || null,
          q.placeholder || null
        ]
      });
    }
    console.log(`Inserted ${questions.length} questions for template ${code}.`);
    return templateId;
  }

  // RATING CHOICES
  const ratingChoices = ["ممتاز", "جيد جداً", "جيد", "يحتاج تحسين", "ضعيف"];

  // ==========================================
  // FORM 1: استمارة التفتيش والرقابة على الصالات وجودة الخدمة
  // ==========================================
  const form1Questions = [
    // Step 1: بيانات التفتيش والصالة
    { code: "emp_no", text: "الرقم الوظيفي للمفتش", type: "number", required: true, step: 1, placeholder: "أدخل رقمك الوظيفي" },
    { code: "date_b", text: "تاريخ التفتيش", type: "date", required: true, step: 1 },
    { code: "shift_period", text: "الفترة", type: "select", required: true, step: 1, options: ["الصباحي", "المسائي"] },
    { code: "time_b", text: "وقت البدء (من)", type: "time", required: true, step: 1 },
    { code: "time_e", text: "وقت الانتهاء (إلى)", type: "time", required: true, step: 1 },
    { code: "location", text: "اختر الصالة", type: "select", required: true, step: 1, options: ["صالة المراسيم", "صالة العائلات", "صالة كالتكس"] },

    // Step 2: سرعة التجاوب (discipline)
    { code: "discipline_q1", text: "تم استقبال العملاء والترحيب بهم خلال (30) ثانية من دخولهم الصالة", type: "rating", required: true, step: 2, options: ratingChoices },
    { code: "discipline_q1_note", text: "تم تقديم قائمة الطعام أو شرح الأصناف فور جلوس العملاء", type: "rating", required: true, step: 2, options: ratingChoices },
    { code: "discipline_q2", text: "تم أخذ الطلب خلال 5 دقائق كحد أعلى", type: "rating", required: true, step: 2, options: ratingChoices },
    { code: "discipline_q2_note", text: "تم تلبية الطلبات الإضافية (ماء، أدوات، إضافات) بسرعة", type: "rating", required: true, step: 2, options: ratingChoices },
    { code: "discipline_q3", text: "تم حل الشكوى أو تحويلها للمشرف المختص خلال مدة لا تتجاوز (5) دقائق", type: "rating", required: true, step: 2, options: ratingChoices },

    // Step 3: جودة الخدمة (workflow)
    { code: "workflow_q1", text: "الموظف بشوش ومحترف في التعامل مع العملاء", type: "rating", required: true, step: 3, options: ratingChoices },
    { code: "workflow_q1_note", text: "شرح الطلبات والإضافات والعروض بوضوح", type: "rating", required: true, step: 3, options: ratingChoices },
    { code: "workflow_q2", text: "محافظة الموظفين على الهدوء أثناء أوقات الازدحام", type: "rating", required: true, step: 3, options: ratingChoices },
    { code: "workflow_q2_note", text: "انتهت الخدمة بأسلوب لائق يعكس جودة الضيافة والترحيب", type: "rating", required: true, step: 3, options: ratingChoices },

    // Step 4: دقة الطلبات (service)
    { code: "service_q1", text: "الطلب مطابق للفاتورة بدقة تامة", type: "rating", required: true, step: 4, options: ratingChoices },
    { code: "service_q1_note", text: "تمت مراجعة وتأكيد الطلب مع العميل بما يشمل كافة الإضافات قبل حفظ الفاتورة", type: "rating", required: true, step: 4, options: ratingChoices },
    { code: "service_q2", text: "تم تسليم الطلب دون أخطاء أو نقص أو زيادة وتصحيح أي ملاحظة فوراً", type: "rating", required: true, step: 4, options: ratingChoices },
    { code: "service_q2_note", text: "تم التأكد من اكتمال الطلب في شباك التشييك قبل تقديمه للعميل", type: "rating", required: true, step: 4, options: ratingChoices },

    // Step 5: التشغيل والإشراف (orders)
    { code: "orders_q1", text: "المشرف حاضر ومتابع لسير العمل داخل الصالة", type: "rating", required: true, step: 5, options: ratingChoices },
    { code: "orders_q1_note", text: "يوجد مسؤول واضح ومحدد عند غياب المشرف", type: "rating", required: true, step: 5, options: ratingChoices },
    { code: "orders_q3", text: "يعرف العاملون الجهة التي يرجعون إليها عند حدوث أي طارئ أو مشكلة", type: "rating", required: true, step: 5, options: ratingChoices },
    { code: "orders_q3_note", text: "التنسيق مع المطبخ وقسم التجهيز فعال وواضح", type: "rating", required: true, step: 5, options: ratingChoices },
    { code: "orders_q4", text: "يتم توزيع المهام بين العاملين بشكل منظم ومناسب", type: "rating", required: true, step: 5, options: ratingChoices },
    { code: "orders_q4_note", text: "مسار الخدمة من استقبال العميل حتى التسليم واضح ومحدد", type: "rating", required: true, step: 5, options: ratingChoices },

    // Step 6: النظافة والمظهر العام (flow)
    { code: "flow_q1", text: "يتم تنظيف الطاولات ومسحها مباشرة بعد مغادرة العميل", type: "rating", required: true, step: 6, options: ratingChoices },
    { code: "flow_q1_note", text: "الأرضيات والممرات ودورات المياه نظيفة وخالية من المخلفات", type: "rating", required: true, step: 6, options: ratingChoices },
    { code: "flow_q2", text: "يلتزم الموظفون بالزي الرسمي النظيف والمظهر الشخصي اللائق", type: "rating", required: true, step: 6, options: ratingChoices },
    { code: "flow_q2_note", text: "لا توجد أدوات غير مستخدمة أو مخلفات ظاهرة داخل الصالة", type: "rating", required: true, step: 6, options: ratingChoices },
    { code: "flow_q3", text: "يتم الالتزام بمعايير الصحة والسلامة المهنية العامة في الصالات", type: "rating", required: true, step: 6, options: ratingChoices },

    // Step 7: الملاحظات العامة والانحرافات (clean)
    { code: "clean_q1_note", text: "ما أفضل سلوك أو تصرف إيجابي تمت ملاحظته اليوم؟", type: "textarea", required: false, step: 7, placeholder: "اكتب السلوك المتميز إن وجد..." },
    { code: "note1", text: "ما هو أكبر انحراف تم رصده في الصالة؟", type: "textarea", required: false, step: 7, placeholder: "اكتب الانحراف الرئيسي للتصحيح..." },
    {
      code: "clean_q2",
      text: "ما أكبر سبب للتأخير داخل الصالة؟",
      type: "select",
      required: true,
      step: 7,
      options: [
        "نقص موظفين",
        "سبب الآيبادات",
        "تأخر المطبخ",
        "ضعف الإشراف",
        "خلل بالنظام",
        "ضغط غير متوقع",
        "أسباب لوجستية أخرى"
      ]
    },
    { code: "note", text: "ملاحظات وتوصيات عامة إضافية", type: "textarea", required: false, step: 7, placeholder: "أي ملاحظات إضافية..." }
  ];

  await upsertTemplate(
    "hall_quality_inspection",
    "استمارة التفتيش والرقابة على الصالات وجودة الخدمة",
    "استمارة التفتيش الميداني الدوري على الصالات، سرعة الاستجابة، جودة الخدمة، دقة الطلبات، ونظافة المرافق.",
    "inspector,admin,super_admin",
    "all",
    form1Questions
  );

  // ==========================================
  // FORM 2: استمارة التقرير اليومي وحصر المشاكل والإنحرافات
  // ==========================================
  const problemChoices = [
    "تأخر طلب", "نقص الطلب", "جوده", "عجز تجهيزات", "نقص مواد", "هدر مواد", "تالف",
    "تاخر دوام", "مخالفة", "نفاذ كمية", "نظافة", "نقص عمال", "مشاكل في النظام", "اهمال",
    "طابعات", "بدون فواتير", "تدريب وتأهيل", "تسرب عمالة", "تطوير عمل", "تقييم",
    "تنظيم عمل", "فائض عمالة", "فائض انتاج", "تحويل دوام", "نقل موظف", "غياب",
    "اجازات", "تظلم", "مشاكل متكررة لم تحل", "جاهزية الافتتاح", "أخرى"
  ];

  const form2Questions = [
    // Step 1: بيانات التقرير
    { code: "reporting", text: "اسم مقدم التقرير", type: "text", required: true, step: 1, placeholder: "الاسم الكامل لمعد التقرير" },
    { code: "job_title", text: "المسمى الوظيفي", type: "text", required: true, step: 1, placeholder: "مثال: مشرف صالة، مراقب جودة، كاشير" },
    { code: "evaluation_date", text: "تاريخ التقرير", type: "date", required: true, step: 1 },

    // Step 2: المشكلة والإنحراف
    { code: "problm_select", text: "نوع المشكلة / الإنحراف", type: "select", required: true, step: 2, options: problemChoices },
    { code: "cleanliness", text: "وصف الحالة أو المشكلة بالتفصيل", type: "textarea", required: true, step: 2, placeholder: "اشرح المشكلة وما حدث بدقة..." },
    { code: "attendance", text: "سبب المشكلة الجذري", type: "textarea", required: true, step: 2, placeholder: "ما هو السبب الأساسي الذي أدى للمشكلة؟" },

    // Step 3: الموقع والوقت والإجراء
    { code: "safety", text: "حدد موقع المشكلة بالضبط", type: "text", required: true, step: 3, placeholder: "مثال: صالة 1 طاولة 4، شباك التسليم، معمل المعجنات" },
    { code: "discipline", text: "حدد وقت حدوث المشكلة بالضبط", type: "time", required: true, step: 3 },
    { code: "optimal_use", text: "الإجراء المتخذ فوراً للتعامل مع الحالة", type: "textarea", required: true, step: 3, placeholder: "ما الذي قمت بفعله فور حدوث الحالة؟" },
    { code: "notes", text: "ملاحظات وتوصيات إضافية للإدارة", type: "textarea", required: false, step: 3, placeholder: "مقترحات لتفادي التكرار مستقبلاً..." }
  ];

  await upsertTemplate(
    "daily_incident_report",
    "استمارة التقرير اليومي وحصر المشاكل والإنحرافات",
    "حصر المشاكل التشغيلية والانحرافات اليومية وتحديد أسبابها ومواقعها والإجراء المتخذ فوراً.",
    "inspector,field_agent,admin,super_admin",
    "all",
    form2Questions
  );

  // ==========================================
  // FORM 3: استمارة تقييم أداء الموظفين والكادر
  // ==========================================
  // Include staff options in choices
  const staffChoices = employeeOptions.length > 0 ? employeeOptions : [
    "حسن مصطفى السكني - كومي 2",
    "ابراهيم امين الرحبي - Junior كاشير",
    "احمد حمود الاشول - Jnnior ايباد",
    "موظف عام - خدمة الصالات"
  ];

  const form3Questions = [
    // Step 1: المشرف والموظف
    { code: "supervisor_select", text: "رقم المسؤول / المشرف المباشر", type: "number", required: true, step: 1, placeholder: "الرقم الوظيفي للمشرف" },
    { code: "type_eval_select", text: "نوع التقييم", type: "select", required: true, step: 1, options: ["اسبوعي", "يومي"] },
    { code: "eval_date", text: "تاريخ التقييم", type: "date", required: true, step: 1 },
    { code: "employee_select", text: "اسم الموظف المراد تقييمه", type: "select", required: true, step: 1, options: staffChoices, help: "اختر الموظف من قائمة الكادر" },

    // Step 2: الكفاءة والأداء (50 درجة)
    { code: "teamwork", text: "1. دقة وجودة الأداء (من 30 درجة)", type: "number", required: true, step: 2, placeholder: "0 - 30", help: "الدرجة القصوى 30" },
    { code: "order_quality", text: "2. سرعة الإنجاز والأداء (من 20 درجة)", type: "number", required: true, step: 2, placeholder: "0 - 20", help: "الدرجة القصوى 20" },

    // Step 3: العلاقات والسلوك المهني (10 درجات)
    { code: "late_orders", text: "3. العلاقات وحسن التعامل مع الرؤساء (من 4 درجات)", type: "number", required: true, step: 3, placeholder: "0 - 4", help: "الدرجة القصوى 4" },
    { code: "no_discrimination", text: "4. العلاقات والتعاون مع الزملاء (من 3 درجات)", type: "number", required: true, step: 3, placeholder: "0 - 3", help: "الدرجة القصوى 3" },
    { code: "communication", text: "5. العلاقات وحسن استقبال العملاء والجمهور (من 3 درجات)", type: "number", required: true, step: 3, placeholder: "0 - 3", help: "الدرجة القصوى 3" },

    // Step 4: المظهر والانضباط بمواعيد العمل (20 درجة)
    { code: "reporting", text: "6. المظهر والزي والنظافة الشخصية (من 5 درجات)", type: "number", required: true, step: 4, placeholder: "0 - 5", help: "الدرجة القصوى 5" },
    { code: "marketing", text: "7. الالتزام بمواعيد العمل - التواجد الفعلي (من 5 درجات)", type: "number", required: true, step: 4, placeholder: "0 - 5", help: "الدرجة القصوى 5" },
    { code: "order_check", text: "8. الالتزام بمواعيد العمل - وقت العمل (من 5 درجات)", type: "number", required: true, step: 4, placeholder: "0 - 5", help: "الدرجة القصوى 5" },
    { code: "customer_tools", text: "9. الالتزام بمواعيد العمل - وقت الراحة (من 5 درجات)", type: "number", required: true, step: 4, placeholder: "0 - 5", help: "الدرجة القصوى 5" },

    // Step 5: اللوائح والإرشادات والمواظبة (20 درجة)
    { code: "table_cleanliness", text: "10. الالتزام باللوائح والسياسات الداخلية (من 5 درجات)", type: "number", required: true, step: 5, placeholder: "0 - 5", help: "الدرجة القصوى 5" },
    { code: "tools_cleanliness", text: "11. الالتزام بالإرشادات الصحية والسلامة (من 5 درجات)", type: "number", required: true, step: 5, placeholder: "0 - 5", help: "الدرجة القصوى 5" },
    { code: "emp", text: "12. الامتثال لتعليمات وتوجيهات المشرف المباشر (من 5 درجات)", type: "number", required: true, step: 5, placeholder: "0 - 5", help: "الدرجة القصوى 5" },
    { code: "deta_avl", text: "13. المواظبة وعدم تكرار الغياب والإجازات (من 5 درجات)", type: "number", required: true, step: 5, placeholder: "0 - 5", help: "الدرجة القصوى 5" },
    { code: "notes", text: "ملاحظات وتوصيات التقييم العام", type: "textarea", required: false, step: 5, placeholder: "ملاحظات عامة حول أداء الموظف..." }
  ];

  await upsertTemplate(
    "employee_eval_form",
    "استمارة تقييم أداء الموظفين والكادر",
    "نموذج تقييم كفاءة وإنتاجية الكادر والموظفين (مجموع 100 درجة) مع ربط مباشر ببيانات الكادر.",
    "inspector,field_agent,admin,super_admin",
    "all",
    form3Questions
  );

  console.log("\n=======================================================");
  console.log("==> ALL 3 FORMS AND QUESTIONS SUCCESSFULLY SEEDED! <==");
  console.log("=======================================================\n");
}

main().catch(err => {
  console.error("FATAL ERROR IN SEEDING:", err);
  process.exit(1);
});
