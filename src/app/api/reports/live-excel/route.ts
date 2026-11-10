import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateExcelWorkbookXML } from "@/lib/excel-helper";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");

    // 1. Verify Security Token
    const validSecret =
      process.env.EXCEL_EXPORT_SECRET ||
      process.env.SESSION_SECRET ||
      "marasim_excel_sync_key_2026_secure";

    if (!secret || secret !== validSecret) {
      return NextResponse.json(
        {
          error: "401 Unauthorized",
          message: "رمز الأمان السري (Secret Token) غير صالح أو مفقود. يرجى تمرير ?secret=YOUR_TOKEN في رابط الاستعلام.",
        },
        { status: 401 }
      );
    }

    // Optional query filters
    const templateId = searchParams.get("template_id");
    const deptFilter = searchParams.get("dept");
    const statusFilter = searchParams.get("status");
    const outputFormat = searchParams.get("format")?.toLowerCase(); // 'json' (default) or 'excel'/'xls'
    const reportType = searchParams.get("type")?.toLowerCase() || "forms"; // 'forms' or 'cases'

    // ================= BRANCH A: CLASSIC CAPA CASES =================
    if (reportType === "cases") {
      let casesSql = `
        SELECT 
          c.case_number as "رقم_البلاغ",
          c.internal_id as "المعرف_الداخلي",
          c.department_name as "الإدارة",
          c.location_name as "الموقع_القسم",
          c.nc_name as "المخالفة",
          c.inspector_name as "المفتش",
          c.description as "الوصف_المرصود",
          c.root_cause as "السبب_الجذري",
          c.obs_date as "تاريخ_الرصد",
          c.obs_time as "وقت_الرصد",
          CASE 
            WHEN c.status = 'pending_assignment' THEN 'بانتظار الفرز الإداري'
            WHEN c.status = 'assigned' THEN 'قيد التنفيذ الميداني'
            WHEN c.status = 'pending_review' THEN 'بانتظار المراجعة والاعتماد'
            WHEN c.status = 'closed' THEN 'مغلق ومعتمد'
            ELSE c.status 
          END as "حالة_البلاغ",
          c.current_round as "الجولة_الحالية",
          c.created_at as "تاريخ_الإنشاء",
          c.closed_at as "تاريخ_الإغلاق"
        FROM cases_master c
        ORDER BY c.case_number DESC
      `;
      const casesRes = await db.execute(casesSql);
      const casesRows = casesRes.rows as unknown as Array<Record<string, any>>;

      return NextResponse.json(casesRows, {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      });
    }

    // ================= BRANCH B: FLATTENED DYNAMIC FORMS (EAV) =================
    // 2. Fetch Templates & Questions
    const templatesRes = await db.execute(
      "SELECT id, code, title, allowed_roles, department_code FROM forms_templates"
    );
    const templates = templatesRes.rows as unknown as any[];
    const templateMap = new Map<number, any>(templates.map((t) => [Number(t.id), t]));

    let questionsSql = "SELECT * FROM form_questions";
    const qArgs: any[] = [];
    if (templateId) {
      questionsSql += " WHERE template_id = ?";
      qArgs.push(Number(templateId));
    }
    questionsSql += " ORDER BY template_id ASC, step_number ASC, order_index ASC";

    const questionsRes = await db.execute({ sql: questionsSql, args: qArgs });
    const questions = questionsRes.rows as unknown as any[];

    // Group questions by template_id
    const questionsByTemplate = new Map<number, any[]>();
    for (const q of questions) {
      const tId = Number(q.template_id);
      if (!questionsByTemplate.has(tId)) {
        questionsByTemplate.set(tId, []);
      }
      questionsByTemplate.get(tId)!.push(q);
    }

    // 3. Fetch Responses
    let responsesSql = "SELECT * FROM forms_responses WHERE 1=1";
    const rArgs: any[] = [];

    if (templateId) {
      responsesSql += " AND template_id = ?";
      rArgs.push(Number(templateId));
    }
    if (deptFilter) {
      responsesSql += " AND department_code = ?";
      rArgs.push(deptFilter);
    }
    if (statusFilter && statusFilter !== "all") {
      responsesSql += " AND status = ?";
      rArgs.push(statusFilter);
    }
    responsesSql += " ORDER BY response_number DESC";

    const responsesRes = await db.execute({ sql: responsesSql, args: rArgs });
    const responses = responsesRes.rows as unknown as any[];

    // 4. Fetch All Associated Answers
    let answersSql = `
      SELECT a.* FROM forms_answers a
      JOIN forms_responses r ON a.response_id = r.id
      WHERE 1=1
    `;
    const aArgs: any[] = [];
    if (templateId) {
      answersSql += " AND r.template_id = ?";
      aArgs.push(Number(templateId));
    }
    if (deptFilter) {
      answersSql += " AND r.department_code = ?";
      aArgs.push(deptFilter);
    }
    if (statusFilter && statusFilter !== "all") {
      answersSql += " AND r.status = ?";
      aArgs.push(statusFilter);
    }

    const answersRes = await db.execute({ sql: answersSql, args: aArgs });
    const answers = answersRes.rows as unknown as any[];

    // Group answers by response_id
    const answersByResponse = new Map<number, any[]>();
    for (const a of answers) {
      const rId = Number(a.response_id);
      if (!answersByResponse.has(rId)) {
        answersByResponse.set(rId, []);
      }
      answersByResponse.get(rId)!.push(a);
    }

    // Collect all unique question texts for consistent tabular header structure
    const allUniqueQuestions: string[] = [];
    questions.forEach((q) => {
      const qText = String(q.question_text).trim();
      if (!allUniqueQuestions.includes(qText)) {
        allUniqueQuestions.push(qText);
      }
    });

    // 5. Flatten EAV into Clean 2D Records
    const flatRows: Array<Record<string, any>> = responses.map((r) => {
      const rId = Number(r.id);
      const tId = Number(r.template_id);
      const tmpl = templateMap.get(tId);
      const rAnswers = answersByResponse.get(rId) || [];
      const tQuestions = questionsByTemplate.get(tId) || [];

      // Map Arabic status labels
      let statusArabic = "غير محدد";
      switch (r.status) {
        case "pending_assignment":
          statusArabic = "بانتظار الفرز الإداري";
          break;
        case "assigned":
          statusArabic = "قيد المعالجة الميدانية";
          break;
        case "pending_review":
          statusArabic = "بانتظار المراجعة والاعتماد";
          break;
        case "completed":
          statusArabic = "مكتمل ومعتمد";
          break;
        case "rejected":
          statusArabic = "مرفوض للاستكمال";
          break;
        default:
          statusArabic = String(r.status);
      }

      // Base Record Metadata
      const row: Record<string, any> = {
        "رقم_الاستمارة": `FR-${r.response_number}`,
        "عنوان_النموذج": tmpl ? tmpl.title : "استمارة فحص جودة",
        "تاريخ_الرصد": String(r.created_at || ""),
        "المفتش_الراصد": String(r.user_name || ""),
        "الإدارة_المعنية": String(r.department_name || ""),
        "القسم_الموقع": String(r.location_name || "-"),
        "حالة_المعاملة": statusArabic,
      };

      // Map each Question to its Column
      allUniqueQuestions.forEach((qText) => {
        // Find if this question exists in this template
        const matchQ = tQuestions.find((q) => String(q.question_text).trim() === qText);
        if (!matchQ) {
          row[qText] = "-";
          return;
        }

        const matchAns = rAnswers.find((a) => Number(a.question_id) === Number(matchQ.id));
        if (!matchAns) {
          row[qText] = "-";
          return;
        }

        // Format value: Override > GPS > Media > Raw Value
        if (matchAns.admin_override_value) {
          row[qText] = String(matchAns.admin_override_value);
        } else if (matchAns.gps_lat) {
          row[qText] = `${matchAns.gps_lat}, ${matchAns.gps_lng}`;
        } else if (matchAns.media_data) {
          row[qText] = "[صورة مرفقة]";
        } else {
          row[qText] = matchAns.answer_value !== null && matchAns.answer_value !== undefined ? String(matchAns.answer_value) : "-";
        }
      });

      // Post-Inspection Curation & Field Execution Columns
      row["المنفذ_المكلف"] = String(r.assigned_to_agent_name || "-");
      row["التوجيهات_الإدارية_المنقحة"] = String(r.curated_notes || "-");
      row["الإجراء_التصحيحي_الميداني"] = String(r.field_action_taken || "-");
      row["ملاحظات_المنفذ"] = String(r.field_notes || "-");
      row["تاريخ_التنفيذ_الميداني"] = String(r.field_executed_at || "-");
      row["تاريخ_آخر_تحديث"] = String(r.updated_at || "");

      return row;
    });

    // ================= BRANCH C: NATIVE EXCEL WORKBOOK STREAMING =================
    if (outputFormat === "excel" || outputFormat === "xls") {
      const columns = Object.keys(flatRows[0] || { "رقم_الاستمارة": "" }).map((k) => ({
        header: k,
        key: k,
        width: 150,
      }));

      const xml = generateExcelWorkbookXML({
        title: "تقرير البلاغات والاستمارات الحية - مطعم المراسيم",
        sheets: [
          {
            name: "البيانات_الحية",
            columns,
            rows: flatRows,
          },
        ],
      });

      return new NextResponse(xml, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.ms-excel; charset=utf-8",
          "Content-Disposition": 'attachment; filename="almarasim_live_data.xls"',
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      });
    }

    // ================= DEFAULT: CLEAN 2D JSON ARRAY FOR POWER QUERY =================
    return NextResponse.json(flatRows, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (error: any) {
    console.error("Live Excel API Error:", error);
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: error?.message || "حدث خطأ أثناء استخراج وتسطيح بيانات الاستمارات.",
      },
      { status: 500 }
    );
  }
}
