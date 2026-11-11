"use server";

import { getPersistedDatabaseMode, setPersistedDatabaseMode, resetDbClient } from "@/lib/db";
import { createClient } from "@libsql/client";
import path from "path";
import fs from "fs";

export async function getDatabaseModeAction(): Promise<"local" | "cloud"> {
  return getPersistedDatabaseMode();
}

export async function testDatabaseConnectionAction(targetMode?: "local" | "cloud"): Promise<{
  success: boolean;
  mode: "local" | "cloud";
  pingTimeMs?: number;
  error?: string;
}> {
  const mode = targetMode || getPersistedDatabaseMode();
  const startTime = Date.now();

  try {
    if (mode === "cloud") {
      const url = process.env.TURSO_DATABASE_URL || "libsql://raeed1-raydalslwy429-hue.aws-eu-central-1.turso.io";
      const authToken = process.env.TURSO_AUTH_TOKEN || "";
      const client = createClient({ url, authToken });
      await client.execute("SELECT 1 as ping");
      const pingTimeMs = Date.now() - startTime;
      return { success: true, mode: "cloud", pingTimeMs };
    } else {
      const localDbPath = path.resolve(process.cwd(), "local.db");
      if (!fs.existsSync(localDbPath)) {
        return { success: false, mode: "local", error: "ملف قاعدة البيانات المحلية (local.db) غير موجود" };
      }
      const client = createClient({ url: `file:${localDbPath.replace(/\\/g, "/")}` });
      await client.execute("SELECT 1 as ping");
      const pingTimeMs = Date.now() - startTime;
      return { success: true, mode: "local", pingTimeMs };
    }
  } catch (err: any) {
    return {
      success: false,
      mode,
      error: err.message?.includes("fetch") || err.message?.includes("network")
        ? "تعذر الاتصال بالسحابة: تحقق من اتصال الإنترنت"
        : (err.message || "فشل الاتصال بقاعدة البيانات"),
    };
  }
}

export async function toggleDatabaseModeAction(requestedMode?: "local" | "cloud"): Promise<{
  success: boolean;
  mode: "local" | "cloud";
  message: string;
  error?: string;
  pingTimeMs?: number;
}> {
  const currentMode = getPersistedDatabaseMode();
  const targetMode = requestedMode || (currentMode === "local" ? "cloud" : "local");

  // If switching to Cloud: Test connection first to prevent stranded state
  if (targetMode === "cloud") {
    const testRes = await testDatabaseConnectionAction("cloud");
    if (!testRes.success) {
      return {
        success: false,
        mode: currentMode,
        error: `⚠️ لم يتم التفعيل: تعذر الاتصال بسحابة Turso (${testRes.error || "تحقق من اتصال الإنترنت"}). تم الإبقاء على وضع الأوفلاين المحلي للحفاظ على استقرار العمل.`,
        message: "لم يتم التحويل للسحابة بسبب تعذر الاتصال",
      };
    }

    // Connection succeeded! Set mode to cloud
    setPersistedDatabaseMode("cloud");
    return {
      success: true,
      mode: "cloud",
      pingTimeMs: testRes.pingTimeMs,
      message: `🎉 تمت عملية التفعيل بنجاح! النظام متصل الآن بسحابة Turso (أونلاين) - استجابة السحابة: ${testRes.pingTimeMs}ms.`,
    };
  } else {
    // Switching to Local
    const testRes = await testDatabaseConnectionAction("local");
    setPersistedDatabaseMode("local");
    return {
      success: true,
      mode: "local",
      pingTimeMs: testRes.pingTimeMs,
      message: "💻 تمت عملية التفعيل بنجاح! النظام يعمل الآن محلياً بالكامل (أوفلاين) على قاعدة البيانات المحلية local.db.",
    };
  }
}
