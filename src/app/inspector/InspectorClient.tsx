"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FormTemplate } from "@/types/dynamic-forms";
import DynamicFormRenderer from "@/components/DynamicFormRenderer";
import InspectorForm from "./InspectorForm";
import {
  Layers,
  Zap,
  Clock,
  ShieldCheck,
  FileText,
  CheckCircle2,
  RefreshCw,
  Camera,
  X,
  ExternalLink,
} from "lucide-react";

interface InspectorClientProps {
  departments?: Array<{ code: string; name: string }>;
  locations: Array<{ code: string; name: string }>;
  categories: Array<{ code: string; name: string; severity?: string }>;
  dynamicTemplates: FormTemplate[];
  recentCases: any[];
}

export default function InspectorClient({
  departments = [],
  locations,
  categories,
  dynamicTemplates,
  recentCases,
}: InspectorClientProps) {
  const router = useRouter();
  const [activeFormMode, setActiveFormMode] = useState<"dynamic" | "classic">(
    dynamicTemplates.length > 0 ? "dynamic" : "classic"
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<number>(
    dynamicTemplates[0]?.id || 1
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewingPhotoUrl, setViewingPhotoUrl] = useState<string | null>(null);

  const selectedTemplate =
    dynamicTemplates.find((t) => t.id === selectedTemplateId) || dynamicTemplates[0];

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 900);
  };

  useEffect(() => {
    const handleDrawerNavigate = (e: any) => {
      const key = e.detail?.key;
      if (!key) return;
      if (key === "dynamic_forms" || key === "dynamic_kobo") {
        setActiveFormMode("dynamic");
      } else if (key === "new_inspection") {
        setActiveFormMode("classic");
      } else if (key === "my_cases" || key === "track_cases") {
        document.getElementById("inspector-history")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };

    const handleAutoRefresh = () => {
      router.refresh();
    };

    window.addEventListener("marasim_drawer_navigate", handleDrawerNavigate);
    window.addEventListener("marasim_data_refreshed", handleAutoRefresh);

    return () => {
      window.removeEventListener("marasim_drawer_navigate", handleDrawerNavigate);
      window.removeEventListener("marasim_data_refreshed", handleAutoRefresh);
    };
  }, [router]);

  const statusLabels: Record<string, { label: string; color: string }> = {
    pending_assignment: { label: "بانتظار فرز وتوجيه الإدارة", color: "bg-amber-100 text-amber-900 border-amber-300" },
    assigned: { label: "قيد التنفيذ الميداني", color: "bg-blue-100 text-blue-900 border-blue-300" },
    pending_review: { label: "جاهز لمراجعة الإدارة", color: "bg-[#682722]/10 text-[#682722] border-[#682722]/30" },
    closed: { label: "مغلق ومعتمد بنجاح", color: "bg-emerald-100 text-emerald-900 border-emerald-300" },
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Photo Viewer Modal */}
      {viewingPhotoUrl && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative max-w-2xl w-full bg-[#1B1111] rounded-3xl p-4 border border-[#D49A3D]/40 shadow-2xl flex flex-col items-center">
            <button
              onClick={() => setViewingPhotoUrl(null)}
              className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-amber-100 font-black text-sm mb-3">صورة حالة عدم المطابقة الميدانية</div>
            <img
              src={viewingPhotoUrl}
              alt="صورة الحالة"
              className="max-h-[75vh] w-auto max-w-full rounded-2xl object-contain border border-white/10"
            />
          </div>
        </div>
      )}

      {/* Left Column: Form Selector & Active Form */}
      <div className="lg:col-span-7 space-y-4">
        {/* Mode Selector Tab */}
        <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 w-full">
            <button
              type="button"
              onClick={() => setActiveFormMode("dynamic")}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                activeFormMode === "dynamic"
                  ? "bg-[#1B1111] text-[#FFC217] shadow-md shadow-black/20"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>الاستمارة الديناميكية (متعددة المراحل)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveFormMode("classic")}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                activeFormMode === "classic"
                  ? "bg-[#682722] text-amber-100 shadow-md shadow-[#682722]/20"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>البلاغ السريع الفوري</span>
            </button>
          </div>
        </div>

        {/* Dynamic Form Engine */}
        {activeFormMode === "dynamic" ? (
          <div className="space-y-4">
            {dynamicTemplates.length > 1 && (
              <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-3">
                <label className="text-xs font-black text-slate-800">اختر نوع الاستمارة الميدانية:</label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(Number(e.target.value))}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                >
                  {dynamicTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedTemplate ? (
              <DynamicFormRenderer
                template={selectedTemplate}
                locations={locations}
                onSuccess={() => {
                  window.dispatchEvent(
                    new CustomEvent("marasim_notification", {
                      detail: {
                        type: "success",
                        title: "تم استلام الاستمارة بنجاح",
                        message: "تم حفظ الاستمارة وترحيلها بنجاح.",
                      },
                    })
                  );
                }}
              />
            ) : (
              <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center text-xs text-slate-400">
                لا توجد استمارات ديناميكية مفعلة حالياً. استخدم البلاغ السريع.
              </div>
            )}
          </div>
        ) : (
          /* Classic Quick Form */
          <div className="bg-white p-6 sm:p-7 rounded-3xl border-2 border-[#D49A3D]/30 shadow-sm">
            <h3 className="text-base font-black text-[#1B1111] mb-5 flex items-center gap-2 border-b border-slate-100 pb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-[#D49A3D]"></span>
              <span>تسجيل بلاغ تفتيش سريع وفوري</span>
            </h3>
            <InspectorForm departments={departments} locations={locations} categories={categories} />
          </div>
        )}
      </div>

      {/* Right Column: Recent Log */}
      <div id="inspector-history" className="lg:col-span-5 bg-white p-6 sm:p-7 rounded-3xl border border-slate-200 shadow-sm space-y-4 scroll-mt-24">
        <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
          <span className="flex items-center gap-2 text-base font-black text-[#1B1111]">
            <Clock className="w-5 h-5 text-[#D49A3D]" />
            <span>سجل البلاغات الأخيرة ({recentCases.length})</span>
          </span>
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF7F4] hover:bg-[#F2ECE4] border border-[#D49A3D]/30 rounded-xl text-xs font-black text-[#1B1111] transition-all"
            title="تحديث فوري للسجل"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#D49A3D] ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{isRefreshing ? "جارٍ التحديث..." : "تحديث سريع"}</span>
          </button>
        </div>

        {recentCases.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs font-bold">
            لا توجد بلاغات مسجلة حتى الآن.
          </div>
        ) : (
          <div className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
            {recentCases.map((c: any) => {
              const st = statusLabels[c.status] || { label: c.status, color: "bg-slate-100 text-slate-800" };
              return (
                <div
                  key={c.id}
                  className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-[#D49A3D]/40 transition-all space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 bg-[#1B1111] text-[#FFC217] rounded-lg text-xs font-mono font-black">
                      #{c.case_number}
                    </span>
                    <span className={`px-2.5 py-0.5 text-[10px] font-black rounded-full border ${st.color}`}>
                      {st.label}
                    </span>
                  </div>

                  <h4 className="text-xs font-black text-slate-900">{c.nc_name}</h4>
                  <p className="text-[11px] text-slate-600 line-clamp-2">{c.description}</p>

                  {/* Photo badge if photo exists */}
                  {c.photo_before && (
                    <button
                      type="button"
                      onClick={() => setViewingPhotoUrl(c.photo_before)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-[#D49A3D]/40 rounded-lg text-[10px] font-black text-[#1B1111] transition-colors"
                    >
                      <Camera className="w-3.5 h-3.5 text-[#D49A3D]" />
                      <span>عرض صورة الحالة المرفقة</span>
                    </button>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold pt-1 border-t border-slate-200/60">
                    <span>{c.location_name}</span>
                    <span>
                      {c.obs_date} {c.obs_time}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
