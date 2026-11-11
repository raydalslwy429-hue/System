"use server";

import { getSession, UserSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

function isAuthorizedAdmin(session: UserSession | null): boolean {
  if (!session) return false;
  return session.role === "admin" || session.role === "super_admin" || session.role === "general_admin";
}

export async function createDailyReportAction(formData: FormData) {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "يرجى تسجيل الدخول أولاً" };
  }

  // Permission Check: Super Admins & General Admins always have access, others must have can_create_daily_report != 0
  const canCreate = session.role === "super_admin" || session.role === "general_admin" || session.can_create_daily_report !== 0;
  if (!canCreate) {
    return { success: false, error: "عذراً، ليس لديك صلاحية إنشاء تقارير يومية في المنظومة. يرجى مراجعة مدير النظام." };
  }

  const reporterName = String(formData.get("reporter_name") || session.full_name).trim();
  const locationCode = String(formData.get("location_code") || "").trim();
  const locationName = String(formData.get("location_name") || "").trim();
  const recipientTo = String(formData.get("recipient_to") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();

  if (!reporterName) {
    return { success: false, error: "اسم مقدم التقرير مطلوب" };
  }
  if (!locationName) {
    return { success: false, error: "يرجى تحديد الموقع أو القسم المرتبط بالتقرير" };
  }
  if (!recipientTo) {
    return { success: false, error: "يرجى تحديد الجهة أو الشخص الموجه له التقرير في حقل (إلى)" };
  }
  if (!title) {
    return { success: false, error: "يرجى كتابة عنوان التقرير أو موضوعه" };
  }
  if (!description) {
    return { success: false, error: "يرجى كتابة وصف ومحتوى التقرير اليومي" };
  }

  // Generate Report Number
  const maxRes = await db.execute("SELECT COALESCE(MAX(report_number), 0) + 1 as next_num FROM daily_reports");
  const reportNumber = Number(maxRes.rows[0]?.next_num || 1);
  const internalId = `REP-2026-${String(reportNumber).padStart(4, "0")}`;

  const now = new Date();
  const reportDate = now.toISOString().split("T")[0];
  const reportTime = now.toTimeString().substring(0, 5);

  await db.execute({
    sql: `INSERT INTO daily_reports (
      report_number, internal_id, reporter_id, reporter_name, reporter_dept, reporter_role,
      location_code, location_name, recipient_to, title, description, status,
      report_date, report_time, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?, datetime('now'))`,
    args: [
      reportNumber,
      internalId,
      session.id,
      reporterName,
      session.department_name,
      session.role,
      locationCode,
      locationName,
      recipientTo,
      title,
      description,
      reportDate,
      reportTime,
    ],
  });

  // Log in Audit Trail
  try {
    await db.execute({
      sql: `INSERT INTO audit_logs (log_id, case_number, event_type, actor_name, actor_role, prev_state, new_state, details)
            VALUES (?, ?, 'DAILY_REPORT_CREATED', ?, ?, NULL, 'submitted', ?)`,
      args: [
        `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        reportNumber,
        session.full_name,
        session.role,
        `تم تقديم تقرير يومي جديد (${title}) موجه إلى: ${recipientTo}`,
      ],
    });
  } catch (e) {
    console.warn("Audit log note:", e);
  }

  revalidatePath("/admin");
  revalidatePath("/inspector");
  revalidatePath("/field");

  return {
    success: true,
    reportNumber,
    internalId,
    message: `🎉 تم حفظ وإرسال التقرير اليومي برقم (#${reportNumber}) بنجاح!`,
  };
}

export async function getDailyReportsAction() {
  const session = await getSession();
  if (!session) return [];

  const res = await db.execute(`
    SELECT id, report_number, internal_id, reporter_id, reporter_name, reporter_dept, reporter_role,
           location_code, location_name, recipient_to, title, description, status,
           report_date, report_time, created_at
    FROM daily_reports
    ORDER BY report_number DESC
    LIMIT 100
  `);

  return res.rows as unknown as any[];
}

export async function toggleUserDailyReportAction(userId: number) {
  const session = await getSession();
  if (!isAuthorizedAdmin(session)) {
    return { success: false, error: "صلاحية محصورة بإدارة النظام العليا" };
  }

  await db.execute({
    sql: `UPDATE users 
          SET can_create_daily_report = CASE WHEN COALESCE(can_create_daily_report, 1) = 1 THEN 0 ELSE 1 END 
          WHERE id = ?`,
    args: [userId],
  });

  revalidatePath("/admin");
  return { success: true, message: "تم تعديل صلاحية التقرير اليومي بنجاح" };
}

export async function getActiveLocationsAction() {
  const res = await db.execute("SELECT code, name, department_code FROM locations WHERE status = 'active' ORDER BY name ASC");
  return res.rows as unknown as Array<{ code: string; name: string; department_code?: string }>;
}
