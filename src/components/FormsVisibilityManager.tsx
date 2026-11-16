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
} from "lucide-react";
import { FormTemplate } from "@/types/dynamic-forms";
import {
  getDynamicTemplatesAction,
  updateTemplateAllowedRolesAction,
  exportDynamicFormToExcelAction,
} from "@/app/actions/dynamic-forms";
import DynamicFormRenderer from "@/components/DynamicFormRenderer";

interface FormsVisibilityManagerProps {
  locations?: Array<{ code: string; name: string }>;
  onOpenBuilder?: () => void;
}

export default function FormsVisibilityManager({
  locations = [],
  onOpenBuilder,
}: FormsVisibilityManagerProps) {
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<FormTemplate | null>(null);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await getDynamicTemplatesAction();
      if (res.success && res.templates) {
        setTemplates(res.templates);
      }
    } catch (err: any) {
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
      // Toggle 'all'
      if (template.allowed_roles === "all") {
        newRoles = ["admin", "super_admin"];
      } else {
        newRoles = ["all"];
      }
    } else {
      if (template.allowed_roles === "all") {
        // Was all, user clicked a specific role to restrict
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

    const finalAllowedRoles = newRoles.join(",");

    try {
      const res = await updateTemplateAllowedRolesAction({
        templateId: template.id,
        allowedRoles: finalAllowedRoles,
      });

      if (res.success) {
        setTemplates((prev) =>
          prev.map((t) => (t.id === template.id ? { ...t, allowed_roles: finalAllowedRoles } : t))
        );
        setMessage({
          type: "success",
          text: `تم تحديث صلاحية عرض (${template.title}) بنجاح!`,
        });
      } else {
        setMessage({ type: "error", text: res.error || "تعذر حفظ التعديلات" });
      }
    } catch {
      setMessage({ type: "error", text: "حدث خطأ في الاتصال بالخادم" });
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
          text: `تم ${newStatus === "active" ? "تفعيل" : "إيقاف"} الاستمارة (${template.title}) بنجاح.`,
        });
      } else {
        setMessage({ type: "error", text: res.error || "تعذر تغيير حالة الاستمارة" });
      }
    } catch {
      setMessage({ type: "error", text: "فشل تغيير الحالة" });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleExport = async (templateId: number) => {
    try {
      const res = await exportDynamicFormToExcelAction(templateId);
      if (res.success && res.rows) {
        const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.rows, null, 2));
        const a = document.createElement("a");
        a.setAttribute("href", jsonStr);
        a.setAttribute("download", `استمارة_${templateId}_بيانات.json`);
        document.body.appendChild(a);
        a.click();
        a.remove();
        setMessage({ type: "success", text: "تم تصدير سجل الاستجابات بنجاح." });
      } else {
        setMessage({ type: "error", text: res.error || "لا توجد استجابات مسجلة بعد" });
      }
    } catch {
      setMessage({ type: "error", text: "تعذر تصدير البيانات" });
    }
  };

  const isRoleActive = (allowedRoles: string, role: string) => {
    if (allowedRoles === "all") return true;
    const list = allowedRoles.split(",").map((r) => r.trim());
    return list.includes(role);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-l from-[#1B1111] via-[#2A1C16] to-[#1B1111] text-white p-6 rounded-3xl border-2 border-[#D49A3D]/40 shadow-xl relative overflow-hidden flex flex-wrap items-center justify-between gap-4">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#FFC217]/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex items-center gap-3">
          <span className="p-3 bg-[#D49A3D] text-[#1B1111] rounded-2xl shadow-md">
            <Sparkles className="w-7 h-7" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white">إدارة وتوزيع الاستمارات الذكية</h2>
              <span className="text-[10px] bg-[#682722] text-amber-100 font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                التحكم المركزي
              </span>
            </div>
            <p className="text-xs font-semibold text-amber-200/80 mt-1">
              أزرار تحكم مباشرة لتحديد من يحق له رؤية وتعبئة كل استمارة (المفتشين، المنفذين، الإداريين، أو الجميع).
            </p>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2">
          {onOpenBuilder && (
            <button
              onClick={onOpenBuilder}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#FFC217] hover:bg-[#D49A3D] text-[#1B1111] font-black text-xs rounded-xl shadow-md transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>إنشاء نموذج جديد مخصص</span>
            </button>
          )}
          <button
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

                  {/* Role Control Buttons (The core requirement) */}
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

                    {/* Operational Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setPreviewTemplate(template)}
                        className="flex-1 py-1.5 px-3 bg-amber-50 hover:bg-amber-100 text-[#682722] border border-amber-200 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>معاينة وتعبئة النموذج</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleExport(template.id)}
                        className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors"
                        title="تصدير الاستجابات"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                        <span>تصدير</span>
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleToggleStatus(template)}
                        className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-colors ${
                          isActive
                            ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200"
                            : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                        }`}
                        title={isActive ? "تعطيل مؤقت" : "إعادة التفعيل"}
                      >
                        {isActive ? "إيقاف" : "تفعيل"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview Modal */}
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
              locations={locations.length > 0 ? locations : [
                { code: "hall_marasim", name: "صالة المراسيم" },
                { code: "hall_families", name: "صالة العائلات" },
                { code: "hall_caltex", name: "صالة كالتكس" }
              ]}
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
