"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Send,
  Sparkles,
  FileText,
  PlusCircle,
  XCircle,
  Layers,
} from "lucide-react";
import {
  getDynamicResponsesAction,
  submitDynamicResponseExecutionAction,
  getDynamicTemplatesAction,
} from "@/app/actions/dynamic-forms";
import { FormResponse, FormTemplate } from "@/types/dynamic-forms";
import DynamicFormRenderer from "@/components/DynamicFormRenderer";
import { addToOfflineQueue } from "@/lib/offline-client";

export default function AssignedDynamicForms({ canExecute }: { canExecute: boolean }) {
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [availableTemplates, setAvailableTemplates] = useState<FormTemplate[]>([]);
  const [activeFillingTemplate, setActiveFillingTemplate] = useState<FormTemplate | null>(null);
  const [drafts, setDrafts] = useState<Record<number, { action: string; notes: string }>>({});
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [respResult, tempResult] = await Promise.all([
        getDynamicResponsesAction("assigned"),
        getDynamicTemplatesAction("field_agent"),
      ]);

      if (respResult.success) {
        setResponses(respResult.responses);
      }
      if (tempResult.success && tempResult.templates) {
        setAvailableTemplates(tempResult.templates);
      }
    } catch {
      setMessage({ type: "error", text: "تعذر الاتصال لتحميل الاستمارات." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const submitResponse = async (responseId: number) => {
    const draft = drafts[responseId];
    if (!draft?.action?.trim()) {
      setMessage({ type: "error", text: "اكتب الإجراء الميداني قبل الإرسال." });
      return;
    }
    setSubmittingId(responseId);
    setMessage(null);

    const queueOfflineDynamicExec = () => {
      addToOfflineQueue("DYNAMIC_FORM_EXECUTION", `معالجة استمارة #${responseId}`, {
        responseId,
        actionTaken: draft.action,
        notes: draft.notes,
      });
      setResponses((current) => current.filter((response) => response.id !== responseId));
      setDrafts((current) => {
        const next = { ...current };
        delete next[responseId];
        return next;
      });
      setMessage({
        type: "success",
        text: "📶 تم حفظ المعالجة في صندوق الصادر (أوفلاين بدون نت) وستُرسل تلقائياً فور توفر الاتصال.",
      });
    };

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      queueOfflineDynamicExec();
      setSubmittingId(null);
      return;
    }

    try {
      const result = await submitDynamicResponseExecutionAction({
        responseId,
        actionTaken: draft.action,
        notes: draft.notes,
      });
      if (result.success) {
        setResponses((current) => current.filter((response) => response.id !== responseId));
        setDrafts((current) => {
          const next = { ...current };
          delete next[responseId];
          return next;
        });
        setMessage({ type: "success", text: "تم إرسال المعالجة إلى الإدارة للمراجعة." });
      } else {
        const errText = result.error || "";
        if (
          errText.includes("الاتصال") ||
          errText.includes("network") ||
          errText.includes("fetch") ||
          errText.includes("fetch failed")
        ) {
          queueOfflineDynamicExec();
        } else {
          setMessage({ type: "error", text: errText || "تعذر إرسال المعالجة." });
        }
      }
    } catch {
      queueOfflineDynamicExec();
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <section className="space-y-6">
      {/* 1. AVAILABLE FORMS TO FILL (NEW INITIATIVES / REPORTS) */}
      {availableTemplates.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-black text-[#1B1111] flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#D49A3D]" />
                <span>الاستمارات والنماذج المصرح لك بتعبئتها</span>
              </h3>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                استمارات مباشرة يمكنك تعبئتها وإرسالها للإدارة (كالتقرير اليومي لحصر المشاكل أو تقييم الأداء).
              </p>
            </div>
            <span className="text-[11px] font-black px-3 py-1 bg-amber-50 text-[#682722] border border-amber-200 rounded-full">
              {availableTemplates.length} استمارات متاحة
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableTemplates.map((template) => (
              <div
                key={template.id}
                className="p-4 rounded-2xl bg-[#FAF7F4] border border-slate-200 flex flex-col justify-between gap-3 hover:border-[#D49A3D] transition-all shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[10px] font-mono font-black text-[#682722] bg-white px-2 py-0.5 rounded border border-amber-200">
                      #{template.code}
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                      <Layers className="w-3 h-3 text-[#D49A3D]" />
                      {template.questions?.length || 0} أسئلة
                    </span>
                  </div>
                  <h4 className="text-xs font-black text-[#1B1111] line-clamp-1">{template.title}</h4>
                  <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">
                    {template.description || "استمارة تشغيلية ميدانية"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveFillingTemplate(template)}
                  className="w-full py-2 px-3 bg-[#1B1111] hover:bg-[#682722] text-[#FFC217] font-black text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-sm active:scale-95"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>تعبئة الاستمارة الآن</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. ASSIGNED RESPONSES AWAITING FIELD EXECUTION */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-base font-black text-[#1B1111] flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-[#D49A3D]" /> الاستمارات الميدانية المسندة إليك للتنفيذ
        </h3>
        <p className="text-xs text-slate-500 font-semibold mt-1">تظهر هنا الاستمارات التي أسندتها الإدارة إلى حسابك لتنفيذ معالجاتها.</p>
      </div>

      {message && (
        <div
          className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
            message.type === "success" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"
          }`}
        >
          {message.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-3xl p-10 text-center text-sm font-bold text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-[#D49A3D]" /> جارٍ تحميل الاستمارات...
        </div>
      ) : responses.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 text-sm font-bold text-slate-500">
          لا توجد استمارات مسندة إليك للتنفيذ حالياً.
        </div>
      ) : (
        responses.map((response) => {
          const draft = drafts[response.id] || { action: "", notes: "" };
          return (
            <article key={response.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h4 className="font-black text-sm text-[#1B1111]">{response.template_title || "استمارة ميدانية"}</h4>
                  <p className="text-[11px] text-slate-500 font-semibold mt-1">
                    رقم الاستمارة #{response.response_number} · {response.location_name || response.department_name}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-black flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> بانتظار التنفيذ
                </span>
              </div>

              {response.curated_notes && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 font-bold">
                  توجيه الإدارة: {response.curated_notes}
                </div>
              )}

              <div className="space-y-2">
                {(response.answers || []).map((answer) => (
                  <div key={answer.id || answer.question_id} className="p-3 rounded-xl bg-[#FAF7F4] border border-slate-100">
                    <p className="text-[11px] font-black text-slate-700 mb-1">
                      {answer.admin_override_value || answer.question_text || answer.question_code || "السؤال"}
                    </p>
                    <p className="text-xs font-semibold text-slate-800 whitespace-pre-wrap">{answer.answer_value || "—"}</p>
                  </div>
                ))}
              </div>

              {canExecute ? (
                <div className="space-y-3 border-t border-slate-100 pt-3">
                  <textarea
                    rows={3}
                    value={draft.action}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [response.id]: { ...draft, action: event.target.value },
                      }))
                    }
                    placeholder="اكتب الإجراء التصحيحي المتخذ ميدانياً..."
                    className="w-full p-3 bg-[#FAF7F4] border border-[#D49A3D]/40 rounded-xl text-xs font-semibold resize-y"
                  />
                  <input
                    value={draft.notes}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [response.id]: { ...draft, notes: event.target.value },
                      }))
                    }
                    placeholder="ملاحظات إضافية (اختياري)"
                    className="w-full h-10 px-3 bg-[#FAF7F4] border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => void submitResponse(response.id)}
                      disabled={submittingId === response.id || !draft.action.trim()}
                      className="px-5 py-2.5 rounded-xl bg-[#D49A3D] text-[#1B1111] text-xs font-black disabled:opacity-50 flex items-center gap-2"
                    >
                      {submittingId === response.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      إرسال إلى الإدارة
                    </button>
                  </div>
                </div>
              ) : (
                <p className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold">
                  هذه الاستمارة متاحة للاطلاع فقط.
                </p>
              )}
            </article>
          );
        })
      )}

      {/* MODAL: FILL DYNAMIC FORM */}
      {activeFillingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl relative border-2 border-[#D49A3D]">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-lg font-black text-[#1B1111]">{activeFillingTemplate.title}</h3>
                <p className="text-xs text-slate-500 font-semibold mt-1">تعبئة وإرسال الاستمارة الميدانية إلى الإدارة</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveFillingTemplate(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <DynamicFormRenderer
              template={activeFillingTemplate}
              locations={[
                { code: "hall_marasim", name: "صالة المراسيم" },
                { code: "hall_families", name: "صالة العائلات" },
                { code: "hall_caltex", name: "صالة كالتكس" },
              ]}
              onSuccess={() => {
                setMessage({ type: "success", text: "تم تسجيل وإرسال الاستمارة بنجاح إلى الإدارة!" });
                setActiveFillingTemplate(null);
                void loadData();
              }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
