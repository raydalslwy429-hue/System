"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  X,
  Search,
  Calendar,
  Clock,
  MapPin,
  User,
  Send,
  Loader2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { getDailyReportsAction } from "@/app/actions/daily_reports";

interface DailyReportsArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCreateNew?: () => void;
  canCreateReport?: boolean;
}

export default function DailyReportsArchiveModal({
  isOpen,
  onClose,
  onOpenCreateNew,
  canCreateReport = true,
}: DailyReportsArchiveModalProps) {
  const [reports, setReports] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      getDailyReportsAction()
        .then((data) => setReports(data || []))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredReports = reports.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      String(r.report_number).includes(q) ||
      (r.title && r.title.toLowerCase().includes(q)) ||
      (r.reporter_name && r.reporter_name.toLowerCase().includes(q)) ||
      (r.location_name && r.location_name.toLowerCase().includes(q)) ||
      (r.recipient_to && r.recipient_to.toLowerCase().includes(q)) ||
      (r.description && r.description.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#FAF7F4] text-slate-800 w-full max-w-3xl rounded-[2.5rem] border-2 border-[#D49A3D]/40 shadow-2xl p-6 sm:p-7 relative overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between pb-4 border-b border-slate-200 mb-4 gap-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#1B1111] text-[#FFC217] rounded-2xl shadow-md border border-[#D49A3D]/30">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-[#1B1111]">
                  أرشيف وسجل التقارير اليومية
                </h3>
                <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full border border-amber-300">
                  {reports.length} تقرير
                </span>
              </div>
              <p className="text-xs text-slate-500 font-semibold">
                استعراض ومتابعة كافة التقارير اليومية المرفوعة من كادر العمل
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canCreateReport && onOpenCreateNew && (
              <button
                onClick={() => {
                  onClose();
                  onOpenCreateNew();
                }}
                className="px-3.5 py-2 bg-gradient-to-r from-[#D49A3D] to-[#B37E2C] text-[#1B1111] font-black rounded-xl text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <span>إنشاء تقرير يومي +</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث برقم التقرير، العنوان، مقدم التقرير، الموقع، أو الجهة الموجه لها..."
            className="w-full h-10 pr-10 pl-4 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#D49A3D]"
          />
        </div>

        {/* Reports List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
          {loading ? (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-[#D49A3D]" />
              <span className="font-bold">جاري تحميل التقارير اليومية...</span>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="py-12 text-center text-slate-400 font-bold bg-white rounded-3xl border border-slate-100 p-6">
              {searchQuery ? "لا توجد نتائج مطابقة لبحثك" : "لا توجد تقارير يومية مسجلة في الأرشيف حتى الآن"}
            </div>
          ) : (
            filteredReports.map((r) => {
              const isExpanded = expandedId === r.id;

              return (
                <div
                  key={r.id}
                  className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3 hover:border-amber-300 transition-all"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">
                        #{r.report_number}
                      </span>
                      <h4 className="font-black text-sm text-[#1B1111]">{r.title}</h4>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-[#D49A3D]" />
                        <span>{r.report_date}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-[#D49A3D]" />
                        <span>{r.report_time}</span>
                      </span>
                    </div>
                  </div>

                  {/* Meta Strip */}
                  <div className="flex flex-wrap items-center gap-3 text-xs bg-[#FAF7F4] p-2.5 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-1.5 font-bold text-slate-700">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>مقدم التقرير: <strong className="text-[#1B1111]">{r.reporter_name}</strong></span>
                      {r.reporter_dept && <span className="text-[10px] text-slate-400">({r.reporter_dept})</span>}
                    </div>
                    <span className="text-slate-300">|</span>
                    <div className="flex items-center gap-1.5 font-bold text-slate-700">
                      <MapPin className="w-3.5 h-3.5 text-[#682722]" />
                      <span>الموقع: <strong className="text-[#1B1111]">{r.location_name}</strong></span>
                    </div>
                    <span className="text-slate-300">|</span>
                    <div className="flex items-center gap-1.5 font-bold text-slate-700">
                      <Send className="w-3.5 h-3.5 text-blue-600 rotate-180" />
                      <span>إلى: <strong className="text-blue-900">{r.recipient_to}</strong></span>
                    </div>
                  </div>

                  {/* Content Preview / Full */}
                  <div className="space-y-1">
                    <span className="font-black text-[#1B1111] block text-[11px]">محتوى التقرير:</span>
                    <p
                      className={`text-slate-600 font-medium leading-relaxed bg-[#FAF7F4] p-3 rounded-xl border border-slate-100 whitespace-pre-wrap ${
                        !isExpanded ? "line-clamp-3" : ""
                      }`}
                    >
                      {r.description}
                    </p>
                    {r.description && r.description.length > 150 && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : r.id)}
                        className="text-[11px] font-bold text-[#682722] hover:underline flex items-center gap-1 cursor-pointer pt-1"
                      >
                        {isExpanded ? (
                          <>
                            <span>طي التقرير</span>
                            <ChevronUp className="w-3 h-3" />
                          </>
                        ) : (
                          <>
                            <span>قراءة التقرير بالكامل</span>
                            <ChevronDown className="w-3 h-3" />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
