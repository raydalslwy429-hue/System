"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { createInspectionAction } from "@/app/actions/capa";
import { addToOfflineQueue } from "@/lib/offline-client";
import { compressImageClient } from "@/lib/image-compression";
import { uploadImageAction } from "@/app/actions/upload-blob";
import {
  Send,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Search,
  X,
  Building2,
  MapPin,
  Tag,
  Camera,
  Image as ImageIcon,
  Trash2,
  Sparkles,
} from "lucide-react";

interface DeptOption {
  code: string;
  name: string;
}

interface LocationOption {
  code: string;
  name: string;
  department_code?: string;
}

interface CategoryOption {
  code: string;
  name: string;
  severity?: string;
  department_code?: string;
  section_code?: string;
}

export default function InspectorForm({
  departments,
  locations,
  categories,
}: {
  departments: DeptOption[];
  locations: LocationOption[];
  categories: CategoryOption[];
}) {
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cascading Selection State
  const [selectedDept, setSelectedDept] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [selectedCategoryCode, setSelectedCategoryCode] = useState<string>("");

  // Search & Typeahead for Categories
  const [catSearchQuery, setCatSearchQuery] = useState("");
  const [isCatDropdownOpen, setIsCatDropdownOpen] = useState(false);

  // Photo State
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoMeta, setPhotoMeta] = useState<{ sizeKb: number; width: number; height: number } | null>(null);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Client UUID for Idempotency
  const [clientUuid, setClientUuid] = useState("");

  useEffect(() => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      setClientUuid(crypto.randomUUID());
    } else {
      setClientUuid(`UUID-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
    }
  }, [successMsg]);

  // Filter sections based on selected department
  const filteredSections = useMemo(() => {
    if (!selectedDept || selectedDept === "all") return locations;
    return locations.filter((loc) => loc.department_code === selectedDept);
  }, [locations, selectedDept]);

  // Filter categories based on department and section
  const availableCategories = useMemo(() => {
    return categories.filter((cat) => {
      const matchDept =
        !selectedDept ||
        selectedDept === "all" ||
        cat.department_code === "all" ||
        !cat.department_code ||
        cat.department_code === selectedDept ||
        cat.department_code.split(",").map((d: string) => d.trim()).includes(selectedDept);

      const matchSec =
        !selectedSection ||
        selectedSection === "all" ||
        cat.section_code === "all" ||
        !cat.section_code ||
        cat.section_code === selectedSection ||
        cat.section_code.split(",").map((s: string) => s.trim()).includes(selectedSection);

      return matchDept && matchSec;
    });
  }, [categories, selectedDept, selectedSection]);

  // Filtered by user search
  const filteredCategories = useMemo(() => {
    if (!catSearchQuery.trim()) return availableCategories;
    const q = catSearchQuery.toLowerCase();
    return availableCategories.filter((cat) => cat.name.toLowerCase().includes(q));
  }, [availableCategories, catSearchQuery]);

  const selectedCategoryObj = useMemo(() => {
    return categories.find((c) => c.code === selectedCategoryCode);
  }, [categories, selectedCategoryCode]);

  const handleDeptChange = (deptCode: string) => {
    setSelectedDept(deptCode);
    setSelectedSection("");
    setSelectedCategoryCode("");
  };

  const handleSectionChange = (secCode: string) => {
    setSelectedSection(secCode);
    setSelectedCategoryCode("");
  };

  // Handle Photo selection & WebP compression
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressingPhoto(true);
      setErrorMsg(null);
      const res = await compressImageClient(file, 1200, 0.78);
      setPhotoBase64(res.base64);
      setPhotoMeta({ sizeKb: res.sizeKb, width: res.width, height: res.height });
    } catch (err: any) {
      setErrorMsg(err.message || "فشل معالجة وضغط الصورة");
    } finally {
      setIsCompressingPhoto(false);
      // Reset input value so same photo can be re-selected if needed
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removePhoto = () => {
    setPhotoBase64(null);
    setPhotoMeta(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedSection) {
      setErrorMsg("يرجى اختيار القسم أو الموقع التشغيلي");
      return;
    }
    if (!selectedCategoryCode) {
      setErrorMsg("يرجى اختيار نوع حالة عدم المطابقة");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const formData = new FormData(e.currentTarget);
    const description = String(formData.get("description") || "").trim();
    const rootCause = String(formData.get("root_cause") || "").trim();
    const inspectorNotes = String(formData.get("inspector_notes") || "").trim();
    const formElement = e.currentTarget;

    const resetFormState = () => {
      formElement.reset();
      setSelectedDept("");
      setSelectedSection("");
      setSelectedCategoryCode("");
      setCatSearchQuery("");
      setPhotoBase64(null);
      setPhotoMeta(null);
      setClientUuid(`insp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
    };

    const queueOfflineCase = () => {
      const payload: any = {
        client_uuid: clientUuid,
        location_code: selectedSection,
        nc_code: selectedCategoryCode,
        description,
        root_cause: rootCause,
        inspector_notes: inspectorNotes,
        photo_before: photoBase64 || null,
      };

      const caseTitle = selectedCategoryObj?.name || selectedCategoryCode;
      addToOfflineQueue("INSPECTION", `رصد حالة: ${caseTitle}`, payload);

      setSuccessMsg("📶 تم حفظ حالة عدم المطابقة والصورة في صندوق الصادر (أوفلاين بدون نت) وسيتم ترحيلها تلقائياً للسيرفر فور توفر الاتصال!");
      resetFormState();
    };

    // If client is completely offline, skip fetch and queue to IndexedDB directly
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      queueOfflineCase();
      setLoading(false);
      return;
    }

    try {
      let finalPhotoUrl = photoBase64;

      // If photo exists, upload to Vercel Blob (or fallback to inline WebP)
      if (photoBase64) {
        try {
          const uploadRes = await uploadImageAction(photoBase64, "insp_before");
          if (uploadRes.success && uploadRes.url) {
            finalPhotoUrl = uploadRes.url;
          }
        } catch (upErr) {
          console.warn("Vercel Blob upload failed, fallback to WebP string:", upErr);
        }
      }

      // Build payload for server action
      const serverPayload = {
        client_uuid: clientUuid,
        location_code: selectedSection,
        nc_code: selectedCategoryCode,
        description,
        root_cause: rootCause,
        inspector_notes: inspectorNotes,
        photo_before: finalPhotoUrl || "",
      };

      const res = await createInspectionAction(serverPayload);

      if (res.success) {
        setSuccessMsg(`🎉 تم حفظ حالة عدم المطابقة برقم (#${res.caseNumber}) بنجاح وترحيلها لحظياً للإدارة!`);
        resetFormState();
      } else {
        const errText = res.error || "";
        if (
          errText.includes("الاتصال") ||
          errText.includes("سحابية") ||
          errText.includes("network") ||
          errText.includes("fetch") ||
          errText.includes("fetch failed")
        ) {
          queueOfflineCase();
        } else {
          setErrorMsg(errText || "حدث خطأ أثناء التسجيل");
        }
      }
    } catch {
      // In catch block (connection dropped or timeout): fallback to offline IndexedDB outbox
      queueOfflineCase();
    } finally {
      setLoading(false);
    }
  };

  const severityBadge = (sev?: string) => {
    switch (sev) {
      case "high":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">حرج / عالي</span>;
      case "medium":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">متوسط</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-300">عادي</span>;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="client_uuid" value={clientUuid} />

      {successMsg && (
        <div className="p-4 bg-emerald-50 border-2 border-emerald-300 text-emerald-950 text-xs font-black rounded-2xl flex items-start gap-2.5 shadow-sm animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600 mt-0.5" />
          <div className="leading-relaxed">{successMsg}</div>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-[#FAF3F3] border-2 border-[#682722]/40 text-[#682722] text-xs font-black rounded-2xl flex items-start gap-2.5 shadow-sm animate-in fade-in">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="leading-relaxed">{errorMsg}</div>
        </div>
      )}

      {/* Step 1: Cascading Department Selection */}
      <div>
        <label className="block text-xs font-black text-[#1B1111] mb-1.5 flex items-center gap-1.5">
          <Building2 className="w-4 h-4 text-[#D49A3D]" />
          <span>1. الإدارة المسؤولة</span>
          <span className="text-slate-400 font-normal text-[11px]">(لتصفية الأقسام وحالات عدم المطابقة)</span>
        </label>
        <select
          value={selectedDept}
          onChange={(e) => handleDeptChange(e.target.value)}
          className="w-full h-11 px-3 bg-[#FAF7F4] border border-[#D49A3D]/40 rounded-xl text-xs font-bold focus:ring-2 focus:ring-[#D49A3D]/30 focus:border-[#D49A3D] focus:outline-none transition-all"
        >
          <option value="">-- جميع الإدارات --</option>
          {departments.map((dept) => (
            <option key={dept.code} value={dept.code}>
              {dept.name}
            </option>
          ))}
        </select>
      </div>

      {/* Step 2: Cascading Section / Location Selection */}
      <div>
        <label className="block text-xs font-black text-[#1B1111] mb-1.5 flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-[#D49A3D]" />
          <span>2. الموقع أو القسم التشغيلي</span>
          <span className="text-[#682722] font-black">*</span>
        </label>
        <select
          value={selectedSection}
          onChange={(e) => handleSectionChange(e.target.value)}
          required
          className="w-full h-11 px-3 bg-[#FAF7F4] border border-[#D49A3D]/40 rounded-xl text-xs font-bold focus:ring-2 focus:ring-[#D49A3D]/30 focus:border-[#D49A3D] focus:outline-none transition-all"
        >
          <option value="">-- اختر القسم التشغيلي --</option>
          {filteredSections.map((loc) => (
            <option key={loc.code} value={loc.code}>
              {loc.name}
            </option>
          ))}
        </select>
      </div>

      {/* Step 3: Cascading & Searchable Category Selection (Typeahead) */}
      <div className="relative">
        <label className="block text-xs font-black text-[#1B1111] mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Tag className="w-4 h-4 text-[#682722]" />
            <span>3. نوع وحالة عدم المطابقة المرصودة</span>
            <span className="text-[#682722] font-black">*</span>
          </span>
          <span className="text-[10px] text-slate-400 font-semibold">
            ({availableCategories.length} حالة متاحة)
          </span>
        </label>

        {/* Selected Pill Display */}
        {selectedCategoryObj ? (
          <div className="p-3 bg-amber-50/80 border-2 border-[#D49A3D] rounded-2xl flex items-center justify-between shadow-sm mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#D49A3D]"></span>
              <span className="font-black text-xs text-[#1B1111]">{selectedCategoryObj.name}</span>
              {severityBadge(selectedCategoryObj.severity)}
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedCategoryCode("");
                setIsCatDropdownOpen(true);
              }}
              className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-white"
              title="تغيير الحالة"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <div className="relative">
              <input
                type="text"
                value={catSearchQuery}
                onFocus={() => setIsCatDropdownOpen(true)}
                onChange={(e) => {
                  setCatSearchQuery(e.target.value);
                  setIsCatDropdownOpen(true);
                }}
                placeholder="ابحث بكتابة حرفين من اسم الحالة (مثال: جو، لحوم، نظا...)"
                className="w-full h-11 pl-10 pr-4 bg-[#FAF7F4] border border-[#D49A3D]/40 rounded-xl text-xs font-bold focus:ring-2 focus:ring-[#D49A3D]/30 focus:border-[#D49A3D] focus:outline-none"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
            </div>

            {/* Dropdown List */}
            {isCatDropdownOpen && (
              <div className="absolute z-30 mt-1.5 w-full bg-white border border-slate-200 rounded-2xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
                {filteredCategories.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 font-bold">
                    لا توجد حالة مطابقة للبحث أو لهذا القسم
                  </div>
                ) : (
                  filteredCategories.map((cat) => (
                    <button
                      key={cat.code}
                      type="button"
                      onClick={() => {
                        setSelectedCategoryCode(cat.code);
                        setIsCatDropdownOpen(false);
                        setCatSearchQuery("");
                      }}
                      className="w-full text-right p-3 hover:bg-amber-50/80 transition-colors flex items-center justify-between text-xs font-black text-slate-800"
                    >
                      <span>{cat.name}</span>
                      <div className="flex items-center gap-2">
                        {severityBadge(cat.severity)}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-black text-[#1B1111] mb-1.5">
          📝 وصف حالة عدم المطابقة التفصيلي <span className="text-[#682722]">*</span>
        </label>
        <textarea
          name="description"
          required
          rows={3}
          placeholder="اكتب وصفاً دقيقاً ومحدداً لما تم رصده في الميدان..."
          className="w-full p-3 bg-[#FAF7F4] border border-[#D49A3D]/40 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#D49A3D]/30 focus:border-[#D49A3D] focus:outline-none resize-none"
        />
      </div>

      {/* Root Cause */}
      <div>
        <label className="block text-xs font-black text-[#1B1111] mb-1.5">
          🔍 السبب الجذري المرصود أو المحتمل
        </label>
        <textarea
          name="root_cause"
          rows={2}
          placeholder="ما هو السبب المباشر لوقوع هذه الحالة حسب تقديرك؟"
          className="w-full p-3 bg-[#FAF7F4] border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#D49A3D]/30 focus:border-[#D49A3D] focus:outline-none resize-none"
        />
      </div>

      {/* Photo Capture & Compression Component */}
      <div className="bg-[#FAF7F4] p-3.5 rounded-2xl border border-[#D49A3D]/30 space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-black text-[#1B1111] flex items-center gap-1.5">
            <Camera className="w-4 h-4 text-[#D49A3D]" />
            <span>📷 صورة إثبات الحالة الميدانية (قبل المعالجة)</span>
            <span className="text-[10px] text-slate-400 font-normal">(اختياري - ضغط تلقائي WebP)</span>
          </label>
          {photoMeta && (
            <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md">
              {photoMeta.sizeKb} KB (WebP)
            </span>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoSelect}
          className="hidden"
          id="inspector-photo-input"
        />

        {photoBase64 ? (
          <div className="relative rounded-xl overflow-hidden border-2 border-[#D49A3D] bg-white p-2 flex items-center gap-3">
            <img
              src={photoBase64}
              alt="معاينة صورة الحالة"
              className="w-16 h-16 object-cover rounded-lg border border-slate-200 flex-shrink-0"
            />
            <div className="flex-1 min-w-0 text-[11px]">
              <div className="font-black text-slate-800 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>تم تجهيز الصورة بنجاح</span>
              </div>
              <div className="text-slate-500 font-mono text-[10px]">
                الأبعاد: {photoMeta?.width}x{photoMeta?.height} بكسل
              </div>
              <div className="text-emerald-700 font-bold text-[10px] mt-0.5 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>مضغوطة وجاهزة للرفع والحفظ</span>
              </div>
            </div>
            <button
              type="button"
              onClick={removePhoto}
              className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
              title="حذف الصورة"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={isCompressingPhoto}
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-3 px-4 border-2 border-dashed border-[#D49A3D]/50 hover:border-[#D49A3D] bg-white rounded-xl text-xs font-bold text-slate-700 hover:text-[#1B1111] transition-all flex items-center justify-center gap-2 group"
          >
            {isCompressingPhoto ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#D49A3D]" />
                <span>جارٍ معالجة وضغط الصورة إلى WebP...</span>
              </>
            ) : (
              <>
                <Camera className="w-4 h-4 text-[#D49A3D] group-hover:scale-110 transition-transform" />
                <span>التقاط صورة بالكاميرا أو اختيار من المعرض</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Inspector Notes */}
      <div>
        <label className="block text-xs font-black text-[#1B1111] mb-1.5">
          💬 ملاحظات وتوجيه فوري للمفتش (اختياري)
        </label>
        <input
          name="inspector_notes"
          type="text"
          placeholder="أي إجراء عاجل تم اتخاذه على أرض الواقع..."
          className="w-full h-11 px-3 bg-[#FAF7F4] border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#D49A3D]/30 focus:border-[#D49A3D] focus:outline-none"
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading || isCompressingPhoto}
        className="w-full h-12 bg-gradient-to-r from-[#D49A3D] via-[#E5A93C] to-[#B87B28] hover:opacity-95 disabled:bg-slate-300 disabled:opacity-60 disabled:cursor-not-allowed text-[#1B1111] font-black rounded-xl shadow-md shadow-[#D49A3D]/30 transition-all flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>جارٍ الإرسال والتأكيد لحظياً...</span>
          </>
        ) : (
          <>
            <Send className="w-4 h-4 rotate-180" />
            <span>إرسال وترحيل الحالة للإدارة فوراً</span>
          </>
        )}
      </button>
    </form>
  );
}
