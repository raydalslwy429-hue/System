"use client";

import React, { useState } from "react";
import {
  Cloud,
  CloudUpload,
  CloudDownload,
  Database,
  FolderTree,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  ShieldCheck,
  FileCode,
  HardDrive,
  GitBranch
} from "lucide-react";
import {
  pushSystemDataAction,
  pullSystemDataAction,
  syncLocalDbAction,
  pushCodeToGithubAction
} from "@/app/actions/capa";

interface DataSyncHubModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DataSyncHubModal({ isOpen, onClose }: DataSyncHubModalProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  if (!isOpen) return null;

  const handleAction = async (actionType: "push" | "pull" | "local" | "github", title: string) => {
    setLoadingAction(actionType);
    setFeedback(null);

    // Immediate offline check for cloud/github actions
    if ((actionType === "push" || actionType === "pull" || actionType === "github") && typeof window !== "undefined" && !navigator.onLine) {
      setFeedback({
        type: "error",
        message: "⚠️ جهاز الكمبيوتر غير متصل بالإنترنت حالياً (Offline). يرجى توصيل الإنترنت (الواي فاي أو الكيبل) ثم الضغط على الزر مجدداً."
      });
      setLoadingAction(null);
      return;
    }

    try {
      let res: { success: boolean; message?: string; error?: string };
      if (actionType === "push") {
        res = await pushSystemDataAction();
      } else if (actionType === "pull") {
        res = await pullSystemDataAction();
      } else if (actionType === "github") {
        res = await pushCodeToGithubAction();
      } else {
        res = await syncLocalDbAction();
      }

      if (res.success) {
        setFeedback({ type: "success", message: res.message || `تم تنفيذ ${title} بنجاح!` });
      } else {
        setFeedback({ type: "error", message: res.error || `فشل تنفيذ ${title}` });
      }
    } catch (err: any) {
      setFeedback({ 
        type: "error", 
        message: err.message?.includes("fetch") 
          ? "⚠️ تعذر الاتصال بالإنترنت أو الخادم. يرجى التأكد من اتصال الإنترنت ثم إعادة المحاولة." 
          : (err.message || "حدث خطأ غير متوقع") 
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const folders = [
    { name: "01_permissions", label: "الصلاحيات والأدوار والمصفوفة", files: "roles.json, permissions_matrix.json" },
    { name: "02_reports", label: "قوالب التقارير والـ KPIs الرسمية", files: "report_config.json" },
    { name: "03_departments", label: "الإدارات والفروع والأقسام", files: "departments.json, locations.json" },
    { name: "04_categories", label: "حالات عدم المطابقة وربطها", files: "categories.json" },
    { name: "05_users", label: "المستخدمين ورموز PIN المعتمدة", files: "users.json" },
    { name: "06_forms", label: "النماذج والاستمارات التفتيشية", files: "forms_templates.json" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#1C1210] text-white w-full max-w-3xl rounded-3xl border-2 border-[#D49A3D]/40 shadow-2xl p-6 sm:p-8 relative overflow-hidden flex flex-col max-h-[92vh]">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#FFC217]/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-5 border-b border-[#D49A3D]/20 mb-6 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#D49A3D] text-[#1B1111] rounded-2xl shadow-lg">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">مركز إدارة ومزامنة بيانات النظام (System Data Hub)</h3>
              <p className="text-xs text-[#FFC217] font-bold">إدارة المجلدات المحلية، المزامنة السحابية، والتشغيل المحلي</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-4 rounded-2xl mb-5 flex items-center gap-3 border ${
              feedback.type === "success"
                ? "bg-emerald-950/70 border-emerald-500/50 text-emerald-200"
                : "bg-rose-950/70 border-rose-500/50 text-rose-200"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <p className="text-xs font-bold">{feedback.message}</p>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto space-y-6 pr-1 relative z-10">
          
          {/* Action Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* 1. Push to Cloud */}
            <div className="bg-[#261A16] border border-[#D49A3D]/30 p-5 rounded-2xl flex flex-col justify-between hover:border-[#D49A3D] transition-all">
              <div>
                <div className="w-10 h-10 rounded-xl bg-[#D49A3D]/20 text-[#FFC217] flex items-center justify-center mb-3">
                  <CloudUpload className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-black text-white mb-1">رفع شامل للسحابة الحية</h4>
                <p className="text-[11px] text-slate-300 leading-relaxed mb-4">
                  مزامنة مجلدات <code className="text-[#FFC217]">system_data</code> ورفع كافة الحالات والإسنادات من قاعدة البيانات المحلية (<code className="text-[#FFC217]">local.db</code>) إلى سحابة Turso.
                </p>
              </div>
              <button
                disabled={loadingAction !== null}
                onClick={() => handleAction("push", "الرفع إلى السحابة")}
                className="w-full py-2.5 px-3 bg-gradient-to-r from-[#D49A3D] to-[#B37E2C] hover:brightness-110 text-[#1B1111] font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
              >
                {loadingAction === "push" ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CloudUpload className="w-4 h-4" />
                )}
                <span>رفع وتحديث السحابة ☁️</span>
              </button>
            </div>

            {/* 2. Push Code to GitHub */}
            <div className="bg-[#261A16] border border-purple-500/40 p-5 rounded-2xl flex flex-col justify-between hover:border-purple-400 transition-all">
              <div>
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center mb-3">
                  <GitBranch className="w-5 h-5" />
                </div>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-black text-white">تحديث الكود والشاشات (GitHub)</h4>
                  <span className="text-[10px] font-mono bg-purple-950/80 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-lg">raydalslwy429-hue/System</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed mb-4">
                  رفع أحدث أكواد البرمجة، الشاشات، التصاميم، والميزات الجديدة إلى مستودعك الخاص في GitHub.
                </p>
              </div>
              <button
                disabled={loadingAction !== null}
                onClick={() => handleAction("github", "رفع وتحديث الكود إلى GitHub")}
                className="w-full py-2.5 px-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
              >
                {loadingAction === "github" ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <GitBranch className="w-4 h-4" />
                )}
                <span>رفع التحديثات البرمجية لـ GitHub 🐙</span>
              </button>
            </div>

            {/* 3. Pull from Cloud */}
            <div className="bg-[#261A16] border border-blue-500/30 p-5 rounded-2xl flex flex-col justify-between hover:border-blue-400 transition-all">
              <div>
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-3">
                  <CloudDownload className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-black text-white mb-1">سحب وتفريغ من السحابة</h4>
                <p className="text-[11px] text-slate-300 leading-relaxed mb-4">
                  جلب أحدث نسخة من سحابة Turso وتفريغها في ملفات ومجلدات <code className="text-blue-300">system_data</code> المحلية.
                </p>
              </div>
              <button
                disabled={loadingAction !== null}
                onClick={() => handleAction("pull", "السحب من السحابة")}
                className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
              >
                {loadingAction === "pull" ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CloudDownload className="w-4 h-4" />
                )}
                <span>سحب وتحديث المجلدات 📥</span>
              </button>
            </div>

            {/* 4. Sync to Local SQLite */}
            <div className="bg-[#261A16] border border-emerald-500/30 p-5 rounded-2xl flex flex-col justify-between hover:border-emerald-400 transition-all">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
                  <HardDrive className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-black text-white mb-1">تحديث الـ DB المحلي</h4>
                <p className="text-[11px] text-slate-300 leading-relaxed mb-4">
                  بناء وتحديث ملف قاعدة البيانات المحلية (<code className="text-emerald-300">local.db</code>) ليعمل التطبيق محلياً أوفلاين.
                </p>
              </div>
              <button
                disabled={loadingAction !== null}
                onClick={() => handleAction("local", "بناء قاعدة البيانات المحلية")}
                className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
              >
                {loadingAction === "local" ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Database className="w-4 h-4" />
                )}
                <span>تحديث قاعدة البيانات المحلية 💾</span>
              </button>
            </div>

          </div>

          {/* Folders Structure Showcase */}
          <div className="bg-[#261A16]/80 border border-white/10 rounded-2xl p-5">
            <h4 className="text-xs font-black text-[#FFC217] mb-3 flex items-center gap-2">
              <FolderTree className="w-4 h-4" />
              <span>مجلدات البيانات المهيكلة في المشروع (system_data/)</span>
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {folders.map((f, idx) => (
                <div key={idx} className="bg-black/40 border border-white/5 p-3 rounded-xl flex items-start gap-3">
                  <FileCode className="w-4 h-4 text-[#D49A3D] mt-0.5 shrink-0" />
                  <div>
                    <span className="font-mono font-bold text-amber-200">{f.name}/</span>
                    <p className="text-[11px] text-slate-200 mt-0.5">{f.label}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{f.files}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
              <span>يمكنك تعديل أي ملف مباشرة في محررك ثم الضغط على "رفع للسحابة".</span>
              <span className="text-[#FFC217] font-bold">النظام الإداري لمطاعم المراسيم</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
