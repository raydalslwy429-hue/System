"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { submitExecutionAction } from "@/app/actions/capa";
import { addToOfflineQueue } from "@/lib/offline-client";
import { compressImageClient } from "@/lib/image-compression";
import { uploadImageAction } from "@/app/actions/upload-blob";
import AssignedDynamicForms from "./AssignedDynamicForms";
import {
  Inbox,
  RotateCcw,
  MapPin,
  Tag,
  AlertTriangle,
  Send,
  Loader2,
  CheckCircle2,
  Calendar,
  Clock,
  ShieldAlert,
  Sparkles,
  Bell,
  RefreshCw,
  Camera,
  X,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
} from "lucide-react";

interface AssignmentItem {
  asgRowId: number;
  asgId: string;
  caseId: number;
  caseNumber: number;
  round: number;
  assignedDept: string;
  deptName: string;
  adminInstructions: string;
  reassignNotes: string;
  asgStatus: string;
  isAccepted?: boolean;
  adminFeedback?: string;
  caseStatus?: string;
  locationName: string;
  ncName: string;
  description: string;
  rootCause: string;
  inspectorNotes?: string;
  inProgressNote?: string;
  actionTaken?: string;
  executorNotes?: string;
  photoBefore?: string;
  photoAfter?: string;
  obsDate: string;
  obsTime: string;
}

interface ClosedCaseItem {
  id: number;
  caseNumber: number;
  locationName: string;
  ncName: string;
  description: string;
  rootCause?: string;
  inspectorNotes?: string;
  actionTaken?: string;
  executorNotes?: string;
  photoBefore?: string;
  photoAfter?: string;
  closedAt: string;
  closedFeedback: string;
}

export default function FieldQueue({
  newAssignments,
  returnedAssignments,
  closedCases = [],
  canExecute = true,
}: {
  newAssignments: AssignmentItem[];
  returnedAssignments: AssignmentItem[];
  closedCases?: ClosedCaseItem[];
  canExecute?: boolean;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"new" | "returned" | "submitted" | "closed" | "dynamic">(
    returnedAssignments.length > 0 ? "returned" : newAssignments.length > 0 ? "new" : "closed"
  );
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [formDataState, setFormDataState] = useState<Record<string, { action: string; notes: string }>>({});
  const [photosState, setPhotosState] = useState<Record<string, { base64: string; sizeKb: number; width: number; height: number }>>({});
  const [compressingAsgId, setCompressingAsgId] = useState<string | null>(null);
  const [viewingPhotoUrl, setViewingPhotoUrl] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Accordion Expand/Collapse State per Card
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  // Initialize first card expanded by default for instant action
  useEffect(() => {
    if (newAssignments.length > 0) {
      setExpandedCards((prev) => ({ ...prev, [newAssignments[0].asgId]: true }));
    } else if (returnedAssignments.length > 0) {
      setExpandedCards((prev) => ({ ...prev, [returnedAssignments[0].asgId]: true }));
    }
  }, [newAssignments, returnedAssignments]);

  const toggleCard = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = (list: AssignmentItem[]) => {
    const next: Record<string, boolean> = {};
    list.forEach((item) => {
      next[item.asgId] = true;
    });
    setExpandedCards(next);
  };

  const collapseAll = () => {
    setExpandedCards({});
  };

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 900);
  };

  useEffect(() => {
    const handleDrawerNavigate = (e: any) => {
      const key = e.detail?.key;
      if (key === "tasks_new") setActiveTab("new");
      else if (key === "tasks_returned") setActiveTab("returned");
      else if (key === "tasks_submitted") setActiveTab("submitted");
      else if (key === "tasks_closed") setActiveTab("closed");
      else if (key === "dynamic_field") setActiveTab("dynamic");
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

  const currentList =
    activeTab === "new"
      ? newAssignments
      : activeTab === "returned"
      ? returnedAssignments
      : [...newAssignments, ...returnedAssignments].filter((assignment) => assignment.asgStatus === "completed");

  const handleInputChange = (asgId: string, field: "action" | "notes", value: string) => {
    setFormDataState((prev) => ({
      ...prev,
      [asgId]: {
        action: field === "action" ? value : prev[asgId]?.action || "",
        notes: field === "notes" ? value : prev[asgId]?.notes || "",
      },
    }));
  };

  const handlePhotoSelect = async (asgId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setCompressingAsgId(asgId);
      setErrorToast(null);
      const res = await compressImageClient(file, 1200, 0.78);
      setPhotosState((prev) => ({
        ...prev,
        [asgId]: {
          base64: res.base64,
          sizeKb: res.sizeKb,
          width: res.width,
          height: res.height,
        },
      }));
    } catch (err: any) {
      setErrorToast(err.message || "فشل ضغط صورة المعالجة الميدانية");
    } finally {
      setCompressingAsgId(null);
      if (fileInputRefs.current[asgId]) {
        fileInputRefs.current[asgId]!.value = "";
      }
    }
  };

  const removePhoto = (asgId: string) => {
    setPhotosState((prev) => {
      const next = { ...prev };
      delete next[asgId];
      return next;
    });
  };

  const handleExecute = async (asg: AssignmentItem) => {
    const data = formDataState[asg.asgId];
    if (!data?.action || data.action.trim() === "") {
      setErrorToast("يرجى كتابة الإجراء التصحيحي المتخذ ميدانياً قبل الإرسال");
      return;
    }

    setSubmittingId(asg.asgId);
    setErrorToast(null);

    const actionText = data.action.trim();
    const notesText = data.notes?.trim() || "";
    const photoObj = photosState[asg.asgId];

    const resetItemState = () => {
      setFormDataState((prev) => {
        const next = { ...prev };
        delete next[asg.asgId];
        return next;
      });
      removePhoto(asg.asgId);
    };

    const queueOfflineExecution = () => {
      addToOfflineQueue(
        "EXECUTION",
        `إجراء تصحيحي لبلاغ #${asg.caseNumber}`,
        {
          caseId: asg.caseId,
          asgId: asg.asgId,
          actionTaken: actionText,
          notes: notesText,
          photo_after: photoObj?.base64 || null,
        }
      );

      setSuccessToast(
        `📶 تم حفظ الإجراء التصحيحي للبلاغ (#${asg.caseNumber}) في صندوق الصادر (أوفلاين بدون نت) وسيتم ترحيله تلقائياً للسيرفر فور توفر الاتصال!`
      );
      resetItemState();
      setTimeout(() => setSuccessToast(null), 6000);
    };

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      queueOfflineExecution();
      setSubmittingId(null);
      return;
    }

    try {
      let finalPhotoUrl = photoObj?.base64 || undefined;

      if (photoObj?.base64) {
        try {
          const uploadRes = await uploadImageAction(photoObj.base64, "exec_after");
          if (uploadRes.success && uploadRes.url) {
            finalPhotoUrl = uploadRes.url;
          }
        } catch (upErr) {
          console.warn("Vercel Blob upload failed, fallback to WebP string:", upErr);
        }
      }

      const res = await submitExecutionAction(
        asg.caseId,
        asg.asgId,
        actionText,
        notesText,
        finalPhotoUrl
      );

      if (res.success) {
        setSuccessToast(
          `🎉 تم إرسال الإجراء التصحيحي للبلاغ رقم (#${asg.caseNumber}) بنجاح وهو الآن قيد مراجعة واعتماد الإدارة.`
        );
        resetItemState();
        setTimeout(() => setSuccessToast(null), 5000);
      } else {
        const errText = res.error || "";
        if (
          errText.includes("الاتصال") ||
          errText.includes("سحابية") ||
          errText.includes("network") ||
          errText.includes("fetch") ||
          errText.includes("fetch failed")
        ) {
          queueOfflineExecution();
        } else {
          setErrorToast(errText || "فشل إرسال الإجراء");
        }
      }
    } catch {
      queueOfflineExecution();
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="w-full max-w-full overflow-hidden">
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
            <div className="text-amber-100 font-black text-sm mb-3">صورة التوثيق الميدانية</div>
            <img
              src={viewingPhotoUrl}
              alt="صورة الحالة"
              className="max-h-[75vh] w-auto max-w-full rounded-2xl object-contain border border-white/10"
            />
          </div>
        </div>
      )}

      {/* Success / Error Toasts */}
      {successToast && (
        <div className="mb-4 p-4 bg-emerald-600 text-white font-black text-xs rounded-2xl shadow-lg flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast(null)} className="text-white/80 hover:text-white text-xs">✕</button>
        </div>
      )}

      {errorToast && (
        <div className="mb-4 p-4 bg-[#682722] text-white font-black text-xs rounded-2xl shadow-lg flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-300" />
            <span>{errorToast}</span>
          </div>
          <button onClick={() => setErrorToast(null)} className="text-white/80 hover:text-white text-xs">✕</button>
        </div>
      )}

      {/* Mobile-Friendly Toolbar & Tabs Switcher */}
      <div className="space-y-3 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-[#EFE8E1] rounded-2xl border border-[#D49A3D]/20 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab("new")}
              className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "new"
                  ? "bg-[#1B1111] text-[#FFC217] shadow-md"
                  : "text-[#1B1111]/70 hover:text-[#1B1111] hover:bg-white/50"
              }`}
            >
              <Inbox className="w-3.5 h-3.5 text-[#D49A3D]" />
              <span>بلاغات جديدة</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-[#1B1111] font-black border border-[#D49A3D]/40">
                {newAssignments.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("submitted")}
              className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "submitted"
                  ? "bg-blue-700 text-white shadow-md"
                  : "text-blue-800 hover:bg-blue-50"
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-blue-300" />
              <span>بانتظار المراجعة</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-900 font-black border border-blue-200">
                {[...newAssignments, ...returnedAssignments].filter((assignment) => assignment.asgStatus === "completed").length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("returned")}
              className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "returned"
                  ? "bg-[#682722] text-white shadow-md shadow-[#682722]/30"
                  : "text-[#682722] hover:bg-[#682722]/10"
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
              <span>معادة للاستكمال</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white text-[#682722] font-black">
                {returnedAssignments.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("closed")}
              className={`flex-1 sm:flex-initial px-3.5 py-2 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "closed"
                  ? "bg-emerald-800 text-white shadow-md shadow-emerald-900/30"
                  : "text-emerald-800 hover:bg-emerald-50"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
              <span>معتمدة ومغلقة</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-900 font-black border border-emerald-300">
                {closedCases.length}
              </span>
            </button>
          </div>

          {/* Action buttons (Expand/Collapse & Refresh) */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {currentList.length > 0 && activeTab !== "dynamic" && activeTab !== "closed" && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => expandAll(currentList)}
                  className="px-2.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 flex items-center gap-1"
                  title="توسيع كافة البطاقات"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline">توسيع الكل</span>
                </button>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="px-2.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 flex items-center gap-1"
                  title="طي كافة البطاقات"
                >
                  <Minimize2 className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline">طي الكل</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1 px-3 py-2 bg-white hover:bg-[#FAF7F4] border border-[#D49A3D]/40 rounded-xl text-xs font-black text-[#1B1111] shadow-xs transition-all"
              title="تحديث فوري"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#D49A3D] ${isRefreshing ? "animate-spin" : ""}`} />
              <span>{isRefreshing ? "تحديث..." : "تحديث سريع"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Forms View */}
      {activeTab === "dynamic" ? (
        <AssignedDynamicForms canExecute={canExecute} />
      ) : activeTab === "closed" ? (
        closedCases.length === 0 ? (
          <div className="bg-white p-8 sm:p-12 rounded-3xl border border-slate-200 text-center shadow-sm">
            <CheckCircle2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-base font-black text-slate-700">لا توجد حالات مغلقة في سجلك حتى الآن</h3>
            <p className="text-xs text-slate-400 mt-1">عند اعتماد الإدارة لإجراءاتك وإغلاق الحالات، ستظهر توجيهات الإدارة هنا كمرجع دائم.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {closedCases.map((c) => (
              <div key={c.id} className="bg-white rounded-2xl border-2 border-emerald-200 p-4 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-900 font-black text-xs rounded-lg border border-emerald-300">
                      حالة مغلقة #{c.caseNumber}
                    </span>
                    <span className="text-xs font-bold text-slate-600">{c.locationName}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">{c.closedAt}</span>
                </div>

                <div className="text-xs space-y-1.5">
                  <div className="font-black text-slate-800">{c.ncName}</div>
                  <div className="text-slate-600 leading-relaxed text-[11px]">{c.description}</div>
                </div>

                {/* Photos Comparison */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {c.photoBefore && (
                    <button
                      type="button"
                      onClick={() => setViewingPhotoUrl(c.photoBefore || null)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-[#D49A3D]/40 rounded-lg text-[10px] font-black text-[#1B1111]"
                    >
                      <Camera className="w-3.5 h-3.5 text-[#D49A3D]" />
                      <span>صورة الحالة قبل المعالجة</span>
                    </button>
                  )}
                  {c.photoAfter && (
                    <button
                      type="button"
                      onClick={() => setViewingPhotoUrl(c.photoAfter || null)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg text-[10px] font-black text-emerald-900"
                    >
                      <Camera className="w-3.5 h-3.5 text-emerald-600" />
                      <span>صورة الحالة بعد المعالجة</span>
                    </button>
                  )}
                </div>

                {c.actionTaken && (
                  <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-200 text-xs">
                    <span className="font-bold text-emerald-900 block mb-0.5 text-[11px]">الإجراء التصحيحي المنفذ:</span>
                    <p className="font-black text-emerald-950 text-xs">{c.actionTaken}</p>
                  </div>
                )}

                <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-300 text-xs text-emerald-950 font-bold">
                  <span className="text-emerald-800 font-black block mb-0.5 text-[11px]">توجيه واعتماد الإدارة النهائي:</span>
                  {c.closedFeedback}
                </div>
              </div>
            ))}
          </div>
        )
      ) : currentList.length === 0 ? (
        <div className="bg-white p-8 sm:p-12 rounded-3xl border border-slate-200 text-center shadow-sm">
          <Sparkles className="w-10 h-10 text-[#D49A3D] mx-auto mb-2" />
          <h3 className="text-base font-black text-[#1B1111]">
            {activeTab === "new"
              ? "رائع! لا توجد بلاغات جديدة بانتظار الإجراء حالياً"
              : activeTab === "submitted"
              ? "لا توجد بلاغات بانتظار مراجعة الإدارة حالياً"
              : "لا توجد بلاغات معادة للاستكمال"}
          </h3>
          <p className="text-xs text-slate-400 mt-1">جميع المهام الميدانية الموكلة لإدارتك مكتملة ومحدّثة لحظياً.</p>
        </div>
      ) : (
        /* ACCORDION COLLAPSIBLE CARDS FOR MOBILE & DESKTOP */
        <div className="space-y-3.5">
          {currentList.map((asg) => {
            const currentData = formDataState[asg.asgId] || { action: "", notes: "" };
            const isSubmitting = submittingId === asg.asgId;
            const currentPhoto = photosState[asg.asgId];
            const isCompressing = compressingAsgId === asg.asgId;
            const isExpanded = !!expandedCards[asg.asgId];

            return (
              <div
                key={asg.asgId}
                className="bg-white rounded-2xl border-2 border-[#D49A3D]/30 shadow-xs overflow-hidden transition-all hover:border-[#D49A3D]"
              >
                {/* Accordion Trigger Header: Compact & Info-Rich */}
                <button
                  type="button"
                  onClick={() => toggleCard(asg.asgId)}
                  className="w-full text-right p-3.5 sm:p-4 bg-gradient-to-r from-[#FAF7F4] via-white to-[#FAF7F4] hover:bg-amber-50/40 transition-colors flex items-center justify-between gap-2.5"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                      <span className="px-2 py-0.5 bg-[#1B1111] text-[#FFC217] font-black text-xs rounded-md font-mono">
                        #{asg.caseNumber}
                      </span>
                      <span className="px-2 py-0.5 bg-[#FAF3F3] text-[#682722] font-black text-[11px] rounded-md border border-[#682722]/20">
                        جولة #{asg.round}
                      </span>

                      {asg.isAccepted || asg.asgStatus === "accepted" || asg.asgStatus === "approved" ? (
                        <span className="px-2 py-0.5 bg-emerald-600 text-white font-black text-[10px] rounded-md flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>معتمد إدارياً ✅</span>
                        </span>
                      ) : asg.asgStatus === "completed" ? (
                        <span className="px-2 py-0.5 bg-purple-700 text-white font-black text-[10px] rounded-md flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>قيد مراجعة الإدارة ⏳</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-500 text-[#1B1111] font-black text-[10px] rounded-md flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>مطلوب إجراء تصحيحي</span>
                        </span>
                      )}

                      {asg.photoBefore && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                          📷 صورة
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate">{asg.ncName}</h4>
                      <span className="text-[11px] text-slate-500 font-semibold">• {asg.locationName}</span>
                    </div>
                  </div>

                  {/* Expand / Collapse Indicator Button */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[11px] font-bold text-[#D49A3D] hidden sm:inline">
                      {isExpanded ? "طي التفاصيل" : "عرض والتنفيذ"}
                    </span>
                    <div className="p-1.5 bg-[#FAF7F4] border border-[#D49A3D]/40 rounded-xl text-[#1B1111]">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </button>

                {/* Expanded Accordion Body */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 border-t border-slate-100 space-y-4 animate-in slide-in-from-top-2 duration-200">
                    {/* Meta Tags */}
                    <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-700">
                      <span className="flex items-center gap-1 bg-[#FAF7F4] border border-slate-200 px-2.5 py-1 rounded-xl text-[11px]">
                        <MapPin className="w-3.5 h-3.5 text-[#D49A3D]" />
                        <span>الموقع: {asg.locationName}</span>
                      </span>
                      <span className="flex items-center gap-1 bg-[#FAF3F3] text-[#682722] border border-[#682722]/20 px-2.5 py-1 rounded-xl text-[11px]">
                        <Tag className="w-3.5 h-3.5 text-[#682722]" />
                        <span>نوع الحالة: {asg.ncName}</span>
                      </span>
                      <span className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl text-[11px] font-mono text-slate-500 mr-auto">
                        <Calendar className="w-3 h-3 text-[#D49A3D]" />
                        <span>{asg.obsDate} {asg.obsTime}</span>
                      </span>
                    </div>

                    {/* Violation Details */}
                    <div className="p-3.5 bg-[#FAF7F4] rounded-2xl border border-slate-200/80 space-y-2">
                      <div className="text-xs font-semibold text-slate-700">
                        <strong className="text-[#1B1111] font-black">وصف المخالفة المرصود: </strong>
                        {asg.description}
                      </div>
                      {asg.rootCause && (
                        <div className="text-xs font-semibold text-[#682722] bg-[#FAF3F3] p-2 rounded-xl border border-[#682722]/20">
                          <strong className="text-[#682722] font-black">السبب الجذري المرصود: </strong>
                          {asg.rootCause}
                        </div>
                      )}
                      {asg.inspectorNotes && (
                        <div className="text-xs font-semibold text-blue-950 bg-blue-50/70 p-2 rounded-xl border border-blue-200">
                          <strong className="text-blue-900 font-black">ملاحظات وتوصيات المفتش: </strong>
                          {asg.inspectorNotes}
                        </div>
                      )}
                    </div>

                    {/* Inspector Photo (Before) if attached */}
                    {asg.photoBefore && (
                      <div className="flex items-center gap-3 bg-amber-50/70 border border-[#D49A3D]/40 p-3 rounded-2xl">
                        <img
                          src={asg.photoBefore}
                          alt="صورة المخالفة قبل المعالجة"
                          className="w-14 h-14 object-cover rounded-xl border border-slate-200 flex-shrink-0 cursor-pointer"
                          onClick={() => setViewingPhotoUrl(asg.photoBefore || null)}
                        />
                        <div className="flex-1 min-w-0 text-xs">
                          <div className="font-black text-[#1B1111]">📷 صورة المخالفة المرفقة من المفتش (قبل المعالجة)</div>
                          <div className="text-slate-500 text-[11px] mt-0.5">انقر على الصورة لتكبيرها وفحص المشكلة بدقة</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setViewingPhotoUrl(asg.photoBefore || null)}
                          className="p-2 text-[#D49A3D] hover:bg-white rounded-xl transition-colors"
                          title="تكبير الصورة"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Live Urgent Admin Directive / Note (أثناء التنفيذ) */}
                    {asg.inProgressNote && (
                      <div className="p-3.5 bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-amber-500/15 border-2 border-amber-500 rounded-2xl text-xs space-y-1 shadow-sm">
                        <div className="flex items-center gap-2 font-black text-[#682722]">
                          <Bell className="w-4 h-4 text-[#D49A3D] animate-bounce shrink-0" />
                          <span>🔔 تنبيه وملاحظة إدارية عاجلة (أثناء التنفيذ):</span>
                        </div>
                        <p className="text-slate-900 font-bold leading-relaxed pr-6 bg-white/80 p-2 rounded-xl border border-amber-200 text-xs">
                          {asg.inProgressNote}
                        </p>
                      </div>
                    )}

                    {/* Admin Instructions */}
                    {asg.adminInstructions && (
                      <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-2xl text-xs text-amber-950 font-bold">
                        <span className="text-[#995F1B]">🎯 توجيهات الإدارة العامة: </span>
                        {asg.adminInstructions}
                      </div>
                    )}

                    {/* RED ALERT: Rejection Notes (When Returned) */}
                    {asg.reassignNotes && (
                      <div className="p-3.5 bg-[#FAF3F3] border-2 border-[#682722] rounded-2xl text-xs text-[#682722] font-semibold space-y-1">
                        <div className="flex items-center gap-1.5 font-black text-[#682722]">
                          <ShieldAlert className="w-4 h-4 text-[#682722]" />
                          <span>⚠️ تنبيه إعادة إسناد / ملاحظات الإدارة للاستكمال:</span>
                        </div>
                        <p className="pr-5 font-bold leading-relaxed text-xs">{asg.reassignNotes}</p>
                      </div>
                    )}

                    {/* CONDITIONAL BODY: Accepted vs Pending Review vs Action Inputs */}
                    {asg.isAccepted || asg.asgStatus === "accepted" || asg.asgStatus === "approved" ? (
                      <div className="p-3.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-2 border-emerald-400 rounded-2xl space-y-2">
                        <div className="flex items-center gap-2 text-emerald-900 font-black text-xs">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <span>تم قبول واعتماد الإجراء من قبل الإدارة ✅</span>
                        </div>

                        {asg.adminFeedback && (
                          <div className="p-2.5 bg-white/90 rounded-xl border border-emerald-200 text-xs text-emerald-950 font-bold">
                            <span className="text-emerald-800 font-black block mb-0.5">ملاحظات اعتماد الإدارة:</span>
                            {asg.adminFeedback}
                          </div>
                        )}
                        <p className="text-[11px] text-emerald-800 font-bold">
                          📌 الحالة مقبولة لديك وتنتظر الاعتماد النهائي لبقية الأقسام لإغلاق البلاغ بالكامل.
                        </p>
                      </div>
                    ) : asg.asgStatus === "completed" ? (
                      <div className="p-3.5 bg-purple-50 border-2 border-purple-300 rounded-2xl space-y-2.5">
                        <div className="flex items-center gap-2 text-purple-900 font-black text-xs">
                          <Clock className="w-4 h-4 text-purple-600 flex-shrink-0" />
                          <span>تم إرسال ردك وإجراءك التصحيحي للإدارة بنجاح وهو قيد المراجعة ⏳</span>
                        </div>

                        {(asg.actionTaken || asg.executorNotes || asg.photoAfter) && (
                          <div className="bg-white/90 p-3 rounded-xl border border-purple-200 text-xs space-y-2">
                            {asg.actionTaken && (
                              <div>
                                <span className="font-bold text-slate-500 block text-[11px]">🛠️ الإجراء الذي أرسلته:</span>
                                <p className="font-black text-slate-800">{asg.actionTaken}</p>
                              </div>
                            )}
                            {asg.executorNotes && (
                              <div>
                                <span className="font-bold text-blue-600 block text-[11px]">💬 ملاحظاتك المرفقة:</span>
                                <p className="font-bold text-blue-950 bg-blue-50/70 p-2 rounded-lg border border-blue-200">{asg.executorNotes}</p>
                              </div>
                            )}
                            {asg.photoAfter && (
                              <div className="pt-1">
                                <button
                                  type="button"
                                  onClick={() => setViewingPhotoUrl(asg.photoAfter || null)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl text-xs font-black text-emerald-900"
                                >
                                  <Camera className="w-4 h-4 text-emerald-600" />
                                  <span>عرض صورة إثبات المعالجة الميدانية المرفقة</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : !canExecute ? (
                      <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold">
                        هذه المهمة متاحة للاطلاع فقط، ولا تملك صلاحية تسجيل أو إرسال إجراء ميداني.
                      </div>
                    ) : (
                      <>
                        {/* Execution Inputs */}
                        <div className="pt-2 border-t border-slate-100 space-y-3">
                          <div>
                            <label className="block text-xs font-black text-[#1B1111] mb-1.5">
                              🛠️ الإجراء التصحيحي المتخذ ميدانياً <span className="text-[#682722]">*</span>
                            </label>
                            <textarea
                              rows={2}
                              value={currentData.action}
                              onChange={(e) => handleInputChange(asg.asgId, "action", e.target.value)}
                              placeholder="اكتب الإجراء الفعلي الذي قمت باتخاذه لمعالجة هذه الحالة بالميدان..."
                              className="w-full p-3 bg-[#FAF7F4] border border-[#D49A3D]/40 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#D49A3D]/30 focus:border-[#D49A3D] focus:outline-none resize-none"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-black text-[#1B1111] mb-1.5">
                              💬 ملاحظات إضافية (اختياري)
                            </label>
                            <input
                              type="text"
                              value={currentData.notes}
                              onChange={(e) => handleInputChange(asg.asgId, "notes", e.target.value)}
                              placeholder="أي ملاحظات أخرى تود إرفاقها للإدارة..."
                              className="w-full h-11 px-3 bg-[#FAF7F4] border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#D49A3D]/30 focus:border-[#D49A3D] focus:outline-none"
                            />
                          </div>

                          {/* Photo After Capture */}
                          <div className="bg-[#FAF7F4] p-3 rounded-2xl border border-[#D49A3D]/30 space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-black text-[#1B1111] flex items-center gap-1.5">
                                <Camera className="w-4 h-4 text-[#D49A3D]" />
                                <span>📷 صورة إثبات المعالجة (بعد الإنجاز)</span>
                                <span className="text-[10px] text-slate-400 font-normal">(WebP)</span>
                              </label>
                              {currentPhoto && (
                                <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md">
                                  {currentPhoto.sizeKb} KB
                                </span>
                              )}
                            </div>

                            <input
                              ref={(el) => {
                                fileInputRefs.current[asg.asgId] = el;
                              }}
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={(e) => handlePhotoSelect(asg.asgId, e)}
                              className="hidden"
                              id={`photo-input-${asg.asgId}`}
                            />

                            {currentPhoto ? (
                              <div className="rounded-xl border-2 border-[#D49A3D] bg-white p-2 flex items-center gap-3">
                                <img
                                  src={currentPhoto.base64}
                                  alt="معاينة صورة المعالجة"
                                  className="w-14 h-14 object-cover rounded-lg border border-slate-200 flex-shrink-0"
                                />
                                <div className="flex-1 min-w-0 text-[11px]">
                                  <div className="font-black text-slate-800 flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>تم تجهيز الصورة</span>
                                  </div>
                                  <div className="text-slate-500 font-mono text-[10px]">
                                    {currentPhoto.width}x{currentPhoto.height} بكسل
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removePhoto(asg.asgId)}
                                  className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl"
                                  title="حذف الصورة"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={isCompressing}
                                onClick={() => fileInputRefs.current[asg.asgId]?.click()}
                                className="w-full py-2.5 px-3 border border-dashed border-[#D49A3D]/60 hover:border-[#D49A3D] bg-white rounded-xl text-xs font-bold text-slate-700 hover:text-[#1B1111] transition-all flex items-center justify-center gap-2"
                              >
                                {isCompressing ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin text-[#D49A3D]" />
                                    <span>جارٍ ضغط الصورة إلى WebP...</span>
                                  </>
                                ) : (
                                  <>
                                    <Camera className="w-4 h-4 text-[#D49A3D]" />
                                    <span>التقاط صورة إثبات المعالجة بالكاميرا</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Action Submit Button: Zero overflow & full responsiveness */}
                        <div className="flex justify-end pt-2">
                          <button
                            onClick={() => handleExecute(asg)}
                            disabled={isSubmitting || isCompressing || !currentData.action?.trim()}
                            className="w-full sm:w-auto min-h-[44px] px-6 py-3 bg-gradient-to-r from-[#D49A3D] via-[#E5A93C] to-[#B87B28] hover:opacity-95 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-[#1B1111] font-black text-xs rounded-xl shadow-md shadow-[#D49A3D]/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                          >
                            {isSubmitting ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>جارٍ الإرسال والتأكيد لحظياً...</span>
                              </>
                            ) : (
                              <>
                                <Send className="w-3.5 h-3.5 rotate-180" />
                                <span>إرسال الإجراء التصحيحي للإدارة</span>
                              </>
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
