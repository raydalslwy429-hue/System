"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  ShieldCheck,
  Eye,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  FileSpreadsheet,
  Layers,
  Users,
  Wrench,
  UserCheck,
  Building2,
  Settings,
  Plus,
  RefreshCw,
  ExternalLink,
  UploadCloud,
  Edit3,
  Trash2,
  Table,
  Download,
  X,
  FileText,
} from "lucide-react";
import { FormTemplate } from "@/types/dynamic-forms";
import * as XLSX from "xlsx";
import {
  getDynamicTemplatesAction,
  updateTemplateAllowedRolesAction,
  exportDynamicFormToExcelAction,
  importKoboXLSFormAction,
  deleteDynamicTemplateAction,
  getTemplateSubmissionsAction,
} from "@/app/actions/dynamic-forms";
import DynamicFormRenderer from "@/components/DynamicFormRenderer";

interface FormsVisibilityManagerProps {
  locations?: Array<{ code: string; name: string }>;
  departments?: Array<{ code: string; name: string }>;
  onOpenBuilder?: () => void;
  onEditTemplate?: (template: FormTemplate) => void;
}

export default function FormsVisibilityManager({
  locations = [],
  departments = [],
  onOpenBuilder,
  onEditTemplate,
}: FormsVisibilityManagerProps) {
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<FormTemplate | null>(null);

  // Import Modal States
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importTitle, setImportTitle] = useState("");
  const [importRoles, setImportRoles] = useState("all");
  const [importDept, setImportDept] = useState("all");
  const [importing, setImporting] = useState(false);

  // Submissions Modal States
  const [selectedSubmissionsTemplate, setSelectedSubmissionsTemplate] = useState<FormTemplate | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await getDynamicTemplatesAction();
      if (res.success && res.templates) {
        setTemplates(res.templates);
      }
    } catch {
      setMessage({ type: "error", text: "تعذر تحميل النماذج والاستمارات" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleToggleRole = async (template: FormTemplate, role: string) => {
    setUpdatingId(template.id);
    setMessage(null);

    let currentRoles = (template.allowed_roles || "all")
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);

    let newRoles: string[];

    if (role === "all") {
      if (template.allowed_roles === "all") {
        newRoles = ["admin", "super_admin"];
      } else {
        newRoles = ["all"];
      }
    } else {
      if (template.allowed_roles === "all") {
        newRoles = ["inspector", "field_agent", "admin"].filter((r) => r !== role);
      } else {
        if (currentRoles.includes(role)) {
          newRoles = currentRoles.filter((r) => r !== role);
          if (newRoles.length === 0) newRoles = ["super_admin"];
        } else {
          newRoles = [...currentRoles, role];
          if (
            newRoles.includes("inspector") &&
            newRoles.includes("field_agent") &&
            newRoles.includes("admin")
          ) {
            newRoles = ["all"];
          }
        }
      }
    }

    const rolesString = newRoles.join(",");

    try {
      const res = await updateTemplateAllowedRolesAction({
        templateId: template.id,
        allowedRoles: rolesString,
      });

      if (res.success) {
        setTemplates((prev) =>
          prev.map((t) => (t.id === template.id ? { ...t, allowed_roles: rolesString } : t))
        );
        setMessage({
          type: "success",
          text: `تم تحديث صلاحيات ظهور نموذج (${template.title}) بنجاح`,
        });
      } else {
        setMessage({ type: "error", text: res.error || "فشل تحديث الصلاحيات" });
      }
    } catch {
      setMessage({ type: "error", text: "حدث خطأ غير متوقع أثناء التحديث" });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleStatus = async (template: FormTemplate) => {
    setUpdatingId(template.id);
    setMessage(null);
    const newStatus = template.status === "active" ? "disabled" : "active";

    try {
      const res = await updateTemplateAllowedRolesAction({
        templateId: template.id,
        allowedRoles: template.allowed_roles,
        status: newStatus,
      });

      if (res.success) {
        setTemplates((prev) =>
          prev.map((t) => (t.id === template.id ? { ...t, status: newStatus } : t))
        );
        setMessage({
          type: "success",
          text: `تم ${newStatus === "active" ? "تفعيل" : "تعطيل"} نموذج (${template.title}) بنجاح`,
        });
      } else {
        setMessage({ type: "error", text: res.error || "فشل تغيير الحالة" });
      }
    } catch {
      setMessage({ type: "error", text: "حدث خطأ غير متوقع أثناء تغيير الحالة" });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleExport = async (templateId: number) => {
    try {
      const res = await exportDynamicFormToExcelAction(templateId);
      if (res.success && res.rows && res.rows.length > 0) {
        const cols = res.columns || [];
        const rows = res.rows || [];

        // Build cleanly formatted Excel rows where every column has its dedicated Arabic header
        const excelRows = rows.map((r) => {
          const rowObj: Record<string, any> = {};
          cols.forEach((c) => {
            const val = r[c.key];
            rowObj[c.header] = val !== undefined && val !== null ? val : "-";
          });
          return rowObj;
        });

        const ws = XLSX.utils.json_to_sheet(excelRows);

        // Auto-calculate column widths for perfect reading
        const colWidths = cols.map((c) => {
          const headerLen = (c.header || "").length;
          const maxValLen = Math.max(
            headerLen,
            ...rows.slice(0, 30).map((r) => String(r[c.key] || "").length)
          );
          return { wch: Math.min(Math.max(maxValLen + 3, 12), 60) };
        });
        ws["!cols"] = colWidths;
        ws["!views"] = [{ RTL: true }];

        const wb = XLSX.utils.book_new();
        const safeTitle = (res.sheetName || "الاستجابات").replace(/[\\/*?[\]:]/g, "").substring(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, safeTitle);

        const filename = `${safeTitle}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, filename);

        setMessage({
          type: "success",
          text: `🎉 تم بنجاح تصدير ملف الإكسيل المنسق (${filename}) بأعمدة مستقلة لكافة البيانات والأسئلة!`,
        });
      } else {
        setMessage({ type: "error", text: res.error || "لا توجد استجابات مسجلة لهذه الاستمارة بعد لتصديرها" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: `فشل التصدير: ${err?.message || "خطأ غير متوقع"}` });
    }
  };

  // Import Kobo XLSForm Handler
  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) {
      setMessage({ type: "error", text: "يرجى اختيار ملف إكسيل (.xlsx أو .xls) للاستيراد" });
      return;
    }

    setImporting(true);
    setMessage(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = (reader.result as string).split(",")[1];
        const res = await importKoboXLSFormAction({
          base64Data,
          filename: importFile.name,
          customTitle: importTitle.trim() || undefined,
          allowedRoles: importRoles,
          departmentCode: importDept,
        });

        if (res.success) {
          setMessage({
            type: "success",
            text: `🎉 تم بنجاح استيراد استمارة (${res.title}) بعدد (${res.questionsCount}) أسئلة و(${res.stepsCount}) مراحل!`,
          });
          setShowImportModal(false);
          setImportFile(null);
          setImportTitle("");
          fetchTemplates();
        } else {
          setMessage({ type: "error", text: res.error || "فشل استيراد الاستمارة" });
        }
        setImporting(false);
      };

      reader.onerror = () => {
        setMessage({ type: "error", text: "تعذر قراءة ملف الإكسيل" });
        setImporting(false);
      };

      reader.readAsDataURL(importFile);
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "حدث خطأ غير متوقع أثناء الرفع" });
      setImporting(false);
    }
  };

  // Delete Template Handler
  const handleDeleteTemplate = async (template: FormTemplate) => {
    if (!confirm(`هل أنت متأكد من حذف الاستمارة (${template.title}) وكافة أسئلتها؟ لا يمكن التراجع عن هذا الإجراء.`)) {
      return;
    }

    setUpdatingId(template.id);
    try {
      const res = await deleteDynamicTemplateAction(template.id);
      if (res.success) {
        setTemplates((prev) => prev.filter((t) => t.id !== template.id));
        setMessage({ type: "success", text: `تم حذف الاستمارة (${template.title}) بنجاح` });
      } else {
        setMessage({ type: "error", text: res.error || "فشل حذف الاستمارة" });
      }
    } catch {
      setMessage({ type: "error", text: "حدث خطأ غير متوقع أثناء الحذف" });
    } finally {
      setUpdatingId(null);
    }
  };

  // Open Submissions Table Modal
  const handleOpenSubmissions = async (template: FormTemplate) => {
    setSelectedSubmissionsTemplate(template);
    setLoadingSubmissions(true);
    try {
      const res = await getTemplateSubmissionsAction(template.id);
      if (res.success && res.submissions) {
        setSubmissions(res.submissions);
      } else {
        setSubmissions([]);
      }
    } catch {
      setSubmissions([]);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const isRoleActive = (rolesStr: string, role: string) => {
    if (!rolesStr || rolesStr === "all") return true;
    const list = rolesStr.split(",").map((r) => r.trim());
    return list.includes(role);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-l from-[#1B1111] via-[#2A1C16] to-[#1B1111] text-white p-6 rounded-3xl border-2 border-[#D49A3D]/40 shadow-xl relative overflow-hidden flex flex-wrap items-center justify-between gap-4">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#FFC217]/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex items-center gap-3">
          <span className="p-3 bg-[#D49A3D] text-[#1B1111] rounded-2xl shadow-md">
            <Sparkles className="w-6 h-6" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white">إدارة وتوزيع الاستمارات الذكية (Kobo Forms)</h2>
              <span className="text-[10px] bg-[#682722] text-amber-100 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                التحكم المركزي
              </span>
            </div>
            <p className="text-xs font-semibold text-amber-200/80 mt-1">
              تحكم كامل في توزيع الاستمارات، استيراد نماذج Kobo XLSForm، تعديل الأسئلة، واستعراض سجل الإرسالات.
            </p>
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-2">
          {/* 📥 زر استيراد من إكسل (XLSForm / Kobo) */}
          <button
            type="button"
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#FAF7F4] hover:bg-white text-[#682722] font-black text-xs rounded-xl border border-amber-300 shadow-md transition-all active:scale-95"
          >
            <UploadCloud className="w-4 h-4 text-[#D49A3D]" />
            <span>استيراد استمارة من إكسيل (XLSForm) 📥</span>
          </button>

          {/* ➕ زر إنشاء استمارة مخصصة */}
          {onOpenBuilder && (
            <button
              type="button"
              onClick={onOpenBuilder}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#FFC217] hover:bg-[#D49A3D] text-[#1B1111] font-black text-xs rounded-xl shadow-md transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>تصميم استمارة جديدة</span>
            </button>
          )}

          <button
            type="button"
            onClick={fetchTemplates}
            disabled={loading}
            className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Messages */}
      {message && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2 border ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          {message.type === "success" ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Form Cards Grid */}
      {loading ? (
        <div className="bg-white rounded-3xl p-16 text-center border border-slate-200">
          <Loader2 className="w-8 h-8 animate-spin text-[#D49A3D] mx-auto mb-3" />
          <p className="text-sm font-black text-slate-600">جارٍ قراءة النماذج والاستمارات...</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-white rounded-3xl p-16 text-center border border-slate-200">
          <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-base font-black text-slate-700">لا توجد استمارات مسجلة حالياً</p>
          <p className="text-xs text-slate-400 mt-1">يمكنك استيراد استمارة من ملف إكسيل XLSForm أو تصميم استمارة جديدة</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {templates.map((template) => {
            const isAll = template.allowed_roles === "all";
            const canInspector = isRoleActive(template.allowed_roles, "inspector");
            const canField = isRoleActive(template.allowed_roles, "field_agent");
            const canAdmin = isRoleActive(template.allowed_roles, "admin");
            const isActive = template.status === "active";
            const isBusy = updatingId === template.id;

            return (
              <div
                key={template.id}
                className={`bg-white rounded-3xl border-2 transition-all p-6 shadow-sm hover:shadow-md relative overflow-hidden ${
                  isActive ? "border-slate-200 hover:border-[#D49A3D]/40" : "border-slate-200 opacity-60 bg-slate-50/50"
                }`}
              >
                {/* Status Indicator Bar */}
                <div
                  className={`absolute top-0 right-0 left-0 h-1.5 ${
                    isActive ? "bg-gradient-to-r from-[#D49A3D] via-[#FFC217] to-[#682722]" : "bg-slate-300"
                  }`}
                />

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  {/* Info Column */}
                  <div className="space-y-2 max-w-xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono font-black px-2.5 py-1 rounded-lg bg-amber-50 text-[#682722] border border-amber-200">
                        #{template.code}
                      </span>
                      <h3 className="text-base font-black text-[#1B1111]">{template.title}</h3>
                      <span
                        className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                          isActive
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}
                      >
                        {isActive ? "مفعلة وتعمل" : "معطلة مؤقتاً"}
                      </span>
                    </div>

                    <p className="text-xs font-medium text-slate-500 leading-relaxed">
                      {template.description || "لا يوجد وصف مدخل لهذه الاستمارة"}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-bold text-slate-600">
                      <span className="flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-md">
                        <Layers className="w-3.5 h-3.5 text-[#D49A3D]" />
                        <span>{template.questions?.length || 0} أسئلة وحقول</span>
                      </span>
                      <span className="flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-md">
                        <Building2 className="w-3.5 h-3.5 text-slate-500" />
                        <span>نطاق الإدارة: {template.department_code === "all" ? "كافة الإدارات" : template.department_code}</span>
                      </span>
                    </div>
                  </div>

                  {/* Role Control Buttons & Operational Actions */}
                  <div className="flex flex-col gap-3 min-w-[280px]">
                    <div className="text-[11px] font-black text-slate-500 flex items-center justify-between">
                      <span>أزرار تحديد الصلاحيات والعرض المباشر:</span>
                      {isBusy && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D49A3D]" />}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {/* 1. المفتشين (inspector) */}
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleToggleRole(template, "inspector")}
                        className={`py-2 px-2.5 rounded-xl text-xs font-black border transition-all flex flex-col items-center gap-1 ${
                          canInspector
                            ? "bg-emerald-500 text-white border-emerald-600 shadow-sm ring-2 ring-emerald-300"
                            : "bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200"
                        }`}
                        title="إتاحة العرض للمفتشين"
                      >
                        <Eye className="w-4 h-4" />
                        <span>المفتشين</span>
                        <span className="text-[9px] font-bold">
                          {canInspector ? "مفعل 👁️" : "مخفي"}
                        </span>
                      </button>

                      {/* 2. المنفذين (field_agent) */}
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleToggleRole(template, "field_agent")}
                        className={`py-2 px-2.5 rounded-xl text-xs font-black border transition-all flex flex-col items-center gap-1 ${
                          canField
                            ? "bg-blue-600 text-white border-blue-700 shadow-sm ring-2 ring-blue-300"
                            : "bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200"
                        }`}
                        title="إتاحة العرض للمنفذين الميدانيين"
                      >
                        <Wrench className="w-4 h-4" />
                        <span>المنفذين</span>
                        <span className="text-[9px] font-bold">
                          {canField ? "مفعل 🛠️" : "مخفي"}
                        </span>
                      </button>

                      {/* 3. الإداريين (admin) */}
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleToggleRole(template, "admin")}
                        className={`py-2 px-2.5 rounded-xl text-xs font-black border transition-all flex flex-col items-center gap-1 ${
                          canAdmin
                            ? "bg-[#682722] text-white border-[#682722] shadow-sm ring-2 ring-rose-300"
                            : "bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200"
                        }`}
                        title="إتاحة العرض لمدراء الأقسام والإداريين"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>الإداريين</span>
                        <span className="text-[9px] font-bold">
                          {canAdmin ? "مفعل 👔" : "مخفي"}
                        </span>
                      </button>

                      {/* 4. الجميع (all) */}
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleToggleRole(template, "all")}
                        className={`py-2 px-2.5 rounded-xl text-xs font-black border transition-all flex flex-col items-center gap-1 ${
                          isAll
                            ? "bg-[#1B1111] text-[#FFC217] border-black shadow-sm ring-2 ring-[#FFC217]/50"
                            : "bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200"
                        }`}
                        title="إتاحة النموذج للجميع"
                      >
                        <Users className="w-4 h-4" />
                        <span>الجميع</span>
                        <span className="text-[9px] font-bold">
                          {isAll ? "الكل 🌐" : "مخصص"}
                        </span>
                      </button>
                    </div>

                    {/* Operational Actions Bar */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                      {/* ✏️ زر تعديل الاستمارة */}
                      {onEditTemplate && (
                        <button
                          type="button"
                          onClick={() => onEditTemplate(template)}
                          className="py-1.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-black flex items-center gap-1 transition-colors"
                          title="تعديل نصوص وحقول الاستمارة"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                          <span>تعديل ✏️</span>
                        </button>
                      )}

                      {/* 📊 زر استعراض الإرسالات */}
                      <button
                        type="button"
                        onClick={() => handleOpenSubmissions(template)}
                        className="py-1.5 px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-black flex items-center gap-1 transition-colors"
                        title="استعراض جدول الإرسالات والإجابات"
                      >
                        <Table className="w-3.5 h-3.5 text-purple-600" />
                        <span>الإرسالات 📊</span>
                      </button>

                      {/* 👁️ زر معاينة وتجربة النموذج */}
                      <button
                        type="button"
                        onClick={() => setPreviewTemplate(template)}
                        className="flex-1 py-1.5 px-3 bg-amber-50 hover:bg-amber-100 text-[#682722] border border-amber-200 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>معاينة وتعبئة</span>
                      </button>

                      {/* 📥 زر تصدير إكسيل */}
                      <button
                        type="button"
                        onClick={() => handleExport(template.id)}
                        className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
                        title="تصدير الاستجابات إلى إكسيل"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                        <span>تصدير</span>
                      </button>

                      {/* تفعيل / إيقاف */}
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleToggleStatus(template)}
                        className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-colors ${
                          isActive
                            ? "bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200"
                            : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                        }`}
                        title={isActive ? "تعطيل مؤقت" : "إعادة التفعيل"}
                      >
                        {isActive ? "إيقاف" : "تفعيل"}
                      </button>

                      {/* 🗑️ زر حذف الاستمارة */}
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDeleteTemplate(template)}
                        className="py-1.5 px-2 bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl text-xs font-bold transition-colors"
                        title="حذف الاستمارة نهائياً"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 📥 MODAL 1: IMPORT KOBO XLSFORM (نافذة استيراد استمارة من إكسيل) */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1B1111]/70 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl border-2 border-[#D49A3D]/40 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-amber-100 text-[#682722] rounded-xl">
                  <UploadCloud className="w-5 h-5 text-[#D49A3D]" />
                </span>
                <div>
                  <h3 className="font-black text-sm text-[#1B1111]">استيراد استمارة Kobo (Excel XLSForm)</h3>
                  <p className="text-[11px] text-slate-400 font-semibold">يدعم صيغ XLSForm القياسية (survey, choices, settings)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  📁 اختر ملف الإكسيل (.xlsx أو .xls) <span className="text-rose-600">*</span>
                </label>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setImportFile(f);
                  }}
                  className="w-full text-xs text-slate-700 file:mr-0 file:ml-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-[#1B1111] file:text-[#FFC217] hover:file:bg-[#2A1C16] border border-dashed border-amber-300 rounded-2xl p-4 bg-amber-50/30 cursor-pointer"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  عنوان الاستمارة (اختياري - سيُستخرج تلقائياً من الملف إذا تُرِك فارغاً):
                </label>
                <input
                  type="text"
                  value={importTitle}
                  onChange={(e) => setImportTitle(e.target.value)}
                  placeholder="مثال: استمارة التفتيش والرقابة على الصالات..."
                  className="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">نطاق الظهور الافتراضي:</label>
                  <select
                    value={importRoles}
                    onChange={(e) => setImportRoles(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  >
                    <option value="all">متاح للجميع (all)</option>
                    <option value="inspector,admin,super_admin">المفتشين والإدارة فقط</option>
                    <option value="field_agent,admin,super_admin">المنفذين والإدارة فقط</option>
                    <option value="admin,super_admin">الإدارة فقط</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5">نطاق الإدارة:</label>
                  <select
                    value={importDept}
                    onChange={(e) => setImportDept(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  >
                    <option value="all">كافة الإدارات</option>
                    {departments.map((d) => (
                      <option key={d.code} value={d.code}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={importing || !importFile}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-[#FFC217] hover:brightness-105 text-[#1B1111] font-black rounded-xl text-xs shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                  <span>{importing ? "جارٍ قراءة وبناء الاستمارة..." : "بدء الاستيراد الفوري"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 📊 MODAL 2: SUBMISSIONS TABLE (نافذة استعراض جدول الإرسالات والإجابات) */}
      {selectedSubmissionsTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#1B1111]/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border-2 border-[#D49A3D]/40">
            {/* Modal Header */}
            <div className="bg-gradient-to-l from-[#1B1111] via-[#2A1C16] to-[#1B1111] p-5 text-white flex items-center justify-between border-b border-[#D49A3D]/30">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#D49A3D] text-[#1B1111] rounded-2xl shadow-sm">
                  <Table className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-base text-white">
                    سجل الإرسالات والردود: {selectedSubmissionsTemplate.title}
                  </h3>
                  <p className="text-xs text-amber-200/80 font-semibold mt-0.5">
                    إجمالي الإرسالات المسجلة: ({submissions.length}) استجابة
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExport(selectedSubmissionsTemplate.id)}
                  className="px-3.5 py-1.5 bg-[#FFC217] text-[#1B1111] rounded-xl text-xs font-black flex items-center gap-1.5 hover:bg-amber-400 transition-all shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تصدير إكسيل</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSubmissionsTemplate(null)}
                  className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Submissions Content */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
              {loadingSubmissions ? (
                <div className="py-16 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-[#D49A3D] mx-auto mb-2" />
                  <p className="text-xs font-black text-slate-500">جارٍ تحميل سجل الإرسالات...</p>
                </div>
              ) : submissions.length === 0 ? (
                <div className="py-16 text-center space-y-2">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto" />
                  <h4 className="text-sm font-black text-slate-700">لا توجد إرسالات مسجلة لهذه الاستمارة حتى الآن</h4>
                  <p className="text-xs text-slate-400">ستظهر هنا تفاصيل التعبئة فور قيام المفتشين أو المنفذين بإرسالها من الميدان.</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-[#FAF7F4] text-[#1B1111] font-black border-b border-slate-200">
                      <tr>
                        <th className="p-3">#</th>
                        <th className="p-3">مقدم التقرير</th>
                        <th className="p-3">الدور</th>
                        <th className="p-3">الموقع / القسم</th>
                        <th className="p-3">تاريخ ووقت الإرسال</th>
                        <th className="p-3">الحالة</th>
                        <th className="p-3">الإجابات والنتائج</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {submissions.map((sub, idx) => (
                        <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 font-mono font-black text-slate-400">#{sub.response_number || idx + 1}</td>
                          <td className="p-3 font-black text-slate-900">{sub.user_name}</td>
                          <td className="p-3 text-slate-600">{sub.user_role}</td>
                          <td className="p-3 font-bold text-slate-700">{sub.location_name}</td>
                          <td className="p-3 text-slate-500 font-mono text-[11px]">{sub.created_at}</td>
                          <td className="p-3">
                            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-bold text-[10px]">
                              {sub.status === "completed" ? "مكتمل ومعتمد" : sub.status}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="max-w-md space-y-1">
                              {sub.answers?.slice(0, 3).map((ans: any, aIdx: number) => (
                                <div key={aIdx} className="text-[11px] text-slate-700 truncate">
                                  <span className="font-bold text-slate-500">{ans.question_text}:</span>{" "}
                                  <span className="font-black text-[#1B1111]">{ans.answer_value}</span>
                                </div>
                              ))}
                              {sub.answers?.length > 3 && (
                                <span className="text-[10px] text-[#682722] font-black">
                                  + ({sub.answers.length - 3}) إجابات إضافية (متاحة في ملف الإكسيل المصدّر)
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedSubmissionsTemplate(null)}
                className="px-5 py-2 bg-[#1B1111] hover:bg-[#682722] text-white font-black text-xs rounded-xl shadow-sm transition-all"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 👁️ MODAL 3: PREVIEW & TEST FORM MODAL */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl relative border-2 border-[#D49A3D]">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-lg font-black text-[#1B1111]">{previewTemplate.title}</h3>
                <p className="text-xs text-slate-500 font-semibold mt-1">معاينة تجريبية حية للاستمارة بكامل مراحلها وحقولها</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewTemplate(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <DynamicFormRenderer
              template={previewTemplate}
              locations={
                locations.length > 0
                  ? locations
                  : [
                      { code: "hall_marasim", name: "صالة المراسيم" },
                      { code: "hall_families", name: "صالة العائلات" },
                      { code: "hall_caltex", name: "صالة كالتكس" },
                    ]
              }
              onSuccess={() => {
                setMessage({ type: "success", text: "تم تسجيل وتجربة الاستمارة بنجاح!" });
                setPreviewTemplate(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
