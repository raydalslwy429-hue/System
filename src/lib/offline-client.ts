"use client";

import {
  createInspectionAction,
  submitExecutionAction,
  assignCaseAction,
  approveTaskAction,
  reassignTaskAction,
  closeCaseEntirelyAction,
  changePinAction,
} from "@/app/actions/capa";
import {
  submitFormResponseAction,
  curateAndAssignResponseAction,
  submitDynamicResponseExecutionAction,
} from "@/app/actions/dynamic-forms";
import { uploadImageAction } from "@/app/actions/upload-blob";

export interface OfflineQueueItem {
  id: string;
  type:
    | "INSPECTION"
    | "EXECUTION"
    | "DECISION_APPROVE"
    | "DECISION_REASSIGN"
    | "DECISION_CLOSE"
    | "ASSIGNMENT"
    | "CHANGE_PIN"
    | "DYNAMIC_FORM_RESPONSE"
    | "CURATED_ASSIGNMENT"
    | "DYNAMIC_FORM_EXECUTION";
  title: string;
  timestamp: string;
  payload: any;
  status: "pending" | "syncing" | "failed";
  error?: string;
  retryCount?: number;
}

// ==========================================
// 📦 INDEXEDDB OUTBOX STORAGE ENGINE
// ==========================================

const DB_NAME = "marasim_capa_offline_v3";
const DB_VERSION = 1;
const STORE_NAME = "outbox_queue";
const LEGACY_STORAGE_KEY = "marasim_offline_queue_v2";

let memoryQueue: OfflineQueueItem[] = [];
let isInitialized = false;
const LISTENERS: Array<(queue: OfflineQueueItem[]) => void> = [];
let isSyncingActive = false;

function openOutboxDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      return reject(new Error("IndexedDB غير مدعوم في هذا المتصفح"));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllFromIndexedDB(): Promise<OfflineQueueItem[]> {
  try {
    const db = await openOutboxDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result || []) as OfflineQueueItem[];
        // Sort descending by id/timestamp
        items.sort((a, b) => (b.id > a.id ? 1 : -1));
        resolve(items);
      };
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    console.warn("IndexedDB read error, using fallback:", err);
    return [];
  }
}

async function putToIndexedDB(item: OfflineQueueItem): Promise<void> {
  try {
    const db = await openOutboxDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(item);
  } catch (err) {
    console.warn("IndexedDB put error:", err);
  }
}

async function deleteFromIndexedDB(id: string): Promise<void> {
  try {
    const db = await openOutboxDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
  } catch (err) {
    console.warn("IndexedDB delete error:", err);
  }
}

async function clearAllIndexedDB(): Promise<void> {
  try {
    const db = await openOutboxDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
  } catch (err) {
    console.warn("IndexedDB clear error:", err);
  }
}

function notifyListeners() {
  const snapshot = [...memoryQueue];
  LISTENERS.forEach((fn) => {
    try {
      fn(snapshot);
    } catch (e) {
      console.error("Queue listener error:", e);
    }
  });
}

// Initialize memory queue from IndexedDB on startup
async function initOutboxQueue() {
  if (typeof window === "undefined" || isInitialized) return;
  isInitialized = true;

  try {
    let items = await getAllFromIndexedDB();

    // Migrate from legacy localStorage if exists
    try {
      const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyRaw) {
        const legacyItems = JSON.parse(legacyRaw) as OfflineQueueItem[];
        if (Array.isArray(legacyItems) && legacyItems.length > 0) {
          for (const item of legacyItems) {
            if (!items.some((i) => i.id === item.id)) {
              items.push(item);
              await putToIndexedDB(item);
            }
          }
          localStorage.removeItem(LEGACY_STORAGE_KEY);
        }
      }
    } catch {}

    memoryQueue = items;
    notifyListeners();
  } catch (err) {
    console.warn("Failed to initialize outbox queue:", err);
  }
}

// Start initialization immediately in browser
if (typeof window !== "undefined") {
  initOutboxQueue();
}

/**
 * Returns current snapshot of outbox queue (synchronous & instant)
 */
export function getOfflineQueue(): OfflineQueueItem[] {
  if (typeof window === "undefined") return [];
  if (!isInitialized) {
    initOutboxQueue();
  }
  return [...memoryQueue];
}

/**
 * Subscribes to outbox queue updates
 */
export function subscribeToQueue(fn: (queue: OfflineQueueItem[]) => void) {
  LISTENERS.push(fn);
  // Initial callback with current queue
  try {
    fn([...memoryQueue]);
  } catch {}
  return () => {
    const idx = LISTENERS.indexOf(fn);
    if (idx !== -1) LISTENERS.splice(idx, 1);
  };
}

/**
 * Adds an item to the outbox queue (IndexedDB + memory cache)
 */
export function addToOfflineQueue(
  type: OfflineQueueItem["type"],
  title: string,
  payload: any
): OfflineQueueItem {
  const newItem: OfflineQueueItem = {
    id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type,
    title,
    timestamp: new Date().toLocaleTimeString("ar-YE", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    payload,
    status: "pending",
    retryCount: 0,
  };

  memoryQueue.unshift(newItem);
  notifyListeners();

  // Async persist to IndexedDB
  putToIndexedDB(newItem).catch((err) => console.error("Error saving to IndexedDB:", err));

  return newItem;
}

/**
 * Removes an item from the outbox queue
 */
export function removeFromOfflineQueue(id: string) {
  memoryQueue = memoryQueue.filter((item) => item.id !== id);
  notifyListeners();
  deleteFromIndexedDB(id).catch((err) => console.error("Error deleting from IndexedDB:", err));
}

/**
 * Clears the entire outbox queue
 */
export function clearOfflineQueue() {
  memoryQueue = [];
  notifyListeners();
  clearAllIndexedDB().catch((err) => console.error("Error clearing IndexedDB:", err));
}

// ==========================================
// 🚀 SINGLE ITEM PROCESSOR & CLOUD SYNC
// ==========================================

export async function processSingleQueueItem(
  item: OfflineQueueItem
): Promise<{ success: boolean; error?: string }> {
  try {
    switch (item.type) {
      case "INSPECTION": {
        // Auto-upload image to Vercel Blob if base64 exists
        if (
          item.payload.photo_before &&
          typeof item.payload.photo_before === "string" &&
          item.payload.photo_before.startsWith("data:image/")
        ) {
          try {
            const uploadRes = await uploadImageAction(item.payload.photo_before, "insp_before");
            if (uploadRes.success && uploadRes.url) {
              item.payload.photo_before = uploadRes.url;
            }
          } catch (e) {
            console.warn("Blob upload fallback during inspection sync:", e);
          }
        }
        const res = await createInspectionAction(item.payload);
        return res;
      }

      case "EXECUTION": {
        // Auto-upload execution after photo if base64 exists
        if (
          item.payload.photo_after &&
          typeof item.payload.photo_after === "string" &&
          item.payload.photo_after.startsWith("data:image/")
        ) {
          try {
            const uploadRes = await uploadImageAction(item.payload.photo_after, "exec_after");
            if (uploadRes.success && uploadRes.url) {
              item.payload.photo_after = uploadRes.url;
            }
          } catch (e) {
            console.warn("Blob upload fallback during execution sync:", e);
          }
        }
        const res = await submitExecutionAction(
          item.payload.caseId,
          item.payload.asgId,
          item.payload.actionTaken,
          item.payload.notes,
          item.payload.photo_after
        );
        return res;
      }

      case "DYNAMIC_FORM_RESPONSE": {
        // Auto-upload any inline question photos in dynamic forms
        if (Array.isArray(item.payload.answers)) {
          for (const ans of item.payload.answers) {
            if (
              ans.media_data &&
              typeof ans.media_data === "string" &&
              ans.media_data.startsWith("data:image/")
            ) {
              try {
                const uploadRes = await uploadImageAction(ans.media_data, "dynamic_ans");
                if (uploadRes.success && uploadRes.url) {
                  ans.media_data = uploadRes.url;
                }
              } catch (e) {
                console.warn("Blob upload fallback during form answer sync:", e);
              }
            }
          }
        }
        const res = await submitFormResponseAction(item.payload);
        return res;
      }

      case "DYNAMIC_FORM_EXECUTION": {
        if (
          item.payload.photoBase64 &&
          typeof item.payload.photoBase64 === "string" &&
          item.payload.photoBase64.startsWith("data:image/")
        ) {
          try {
            const uploadRes = await uploadImageAction(item.payload.photoBase64, "dynamic_exec");
            if (uploadRes.success && uploadRes.url) {
              item.payload.photoBase64 = uploadRes.url;
            }
          } catch (e) {
            console.warn("Blob upload fallback during dynamic execution sync:", e);
          }
        }
        const res = await submitDynamicResponseExecutionAction(item.payload);
        return res;
      }

      case "CURATED_ASSIGNMENT": {
        const res = await curateAndAssignResponseAction(item.payload);
        return res;
      }

      case "DECISION_APPROVE": {
        const res = await approveTaskAction(item.payload.asgId, item.payload.notes);
        return res;
      }

      case "DECISION_REASSIGN": {
        const res = await reassignTaskAction(
          item.payload.caseId,
          item.payload.targetDepts,
          item.payload.reassignNotes
        );
        return res;
      }

      case "DECISION_CLOSE": {
        const res = await closeCaseEntirelyAction(item.payload.caseId, item.payload.closureNotes);
        return res;
      }

      case "ASSIGNMENT": {
        const res = await assignCaseAction(
          item.payload.caseId,
          item.payload.targetDepts,
          item.payload.instructions
        );
        return res;
      }

      case "CHANGE_PIN": {
        const res = await changePinAction(item.payload.currentPin, item.payload.newPin);
        return res;
      }

      default:
        return { success: false, error: "نوع العملية غير معروف" };
    }
  } catch (err: any) {
    const isFetchErr = err?.message?.includes("fetch") || err?.toString()?.includes("fetch");
    return {
      success: false,
      error: isFetchErr
        ? "تعذر الاتصال بالخادم أو قاعدة البيانات (الجهاز غير متصل أو السيرفر غير متاح)"
        : err.message || "حدث خطأ أثناء المزامنة",
    };
  }
}

/**
 * Synchronizes all pending items in the offline queue to the server.
 */
export async function syncAllOfflineQueue(
  onProgress?: (syncedCount: number, totalCount: number) => void
): Promise<{ successCount: number; failureCount: number }> {
  if (isSyncingActive) {
    return { successCount: 0, failureCount: 0 };
  }
  isSyncingActive = true;

  try {
    const queue = [...memoryQueue];
    if (queue.length === 0) return { successCount: 0, failureCount: 0 };

    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      item.status = "syncing";
      notifyListeners();

      const result = await processSingleQueueItem(item);
      if (result.success) {
        successCount++;
        removeFromOfflineQueue(item.id);
      } else {
        failureCount++;
        item.status = "failed";
        item.error = result.error || "تعذر الإرسال";
        item.retryCount = (item.retryCount || 0) + 1;
        putToIndexedDB(item).catch(() => {});
        notifyListeners();
      }

      if (onProgress) {
        onProgress(successCount + failureCount, queue.length);
      }
    }

    return { successCount, failureCount };
  } finally {
    isSyncingActive = false;
  }
}

// ==========================================
// 🔄 AUTOMATIC BACKGROUND SYNC WORKER
// ==========================================

export function triggerQuickRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("marasim_data_refreshed"));
  }
}

if (typeof window !== "undefined") {
  const runBackgroundSync = async () => {
    if (!navigator.onLine || isSyncingActive || memoryQueue.length === 0) return;

    try {
      const res = await syncAllOfflineQueue();
      if (res.successCount > 0) {
        window.dispatchEvent(
          new CustomEvent("marasim_notification", {
            detail: {
              type: "success",
              title: "تمت المزامنة التلقائية بنجاح 🚀",
              message: `تم ترحيل (${res.successCount}) معاملة من صندوق الصادر إلى السيرفر تلقائياً بمجرد توفر الاتصال.`,
            },
          })
        );
        triggerQuickRefresh();
      }
    } catch (e) {
      console.warn("Background auto-sync tick skipped:", e);
    }
  };

  // Sync immediately when connection is restored
  window.addEventListener("online", () => {
    console.log("🌐 Connection restored! Starting auto-sync...");
    runBackgroundSync();
  });

  // Background interval tick every 15 seconds
  setInterval(() => {
    if (navigator.onLine && memoryQueue.length > 0) {
      runBackgroundSync();
    }
  }, 15000);
}

// ==========================================
// 📝 INDEXEDDB DRAFTS ENGINE FOR DYNAMIC FORMS
// ==========================================

const DRAFT_DB_NAME = "marasim_capa_drafts_v1";
const DRAFT_STORE_NAME = "form_drafts";

function openDraftDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      return reject(new Error("IndexedDB not supported"));
    }

    const request = indexedDB.open(DRAFT_DB_NAME, 1);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(DRAFT_STORE_NAME)) {
        db.createObjectStore(DRAFT_STORE_NAME, { keyPath: "template_id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveFormDraft(
  templateId: number,
  answers: Record<number, any>,
  currentStep: number,
  locationCode?: string
): Promise<void> {
  try {
    const db = await openDraftDB();
    const tx = db.transaction(DRAFT_STORE_NAME, "readwrite");
    const store = tx.objectStore(DRAFT_STORE_NAME);
    store.put({
      template_id: templateId,
      answers,
      current_step: currentStep,
      location_code: locationCode || "",
      saved_at: new Date().toISOString(),
    });
  } catch (e) {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        `marasim_draft_${templateId}`,
        JSON.stringify({
          answers,
          current_step: currentStep,
          location_code: locationCode,
          saved_at: new Date().toISOString(),
        })
      );
    }
  }
}

export async function getFormDraft(
  templateId: number
): Promise<{ answers: Record<number, any>; current_step: number; location_code?: string; saved_at: string } | null> {
  try {
    const db = await openDraftDB();
    return new Promise((resolve) => {
      const tx = db.transaction(DRAFT_STORE_NAME, "readonly");
      const store = tx.objectStore(DRAFT_STORE_NAME);
      const req = store.get(templateId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem(`marasim_draft_${templateId}`);
      return raw ? JSON.parse(raw) : null;
    }
    return null;
  }
}

export async function clearFormDraft(templateId: number): Promise<void> {
  try {
    const db = await openDraftDB();
    const tx = db.transaction(DRAFT_STORE_NAME, "readwrite");
    tx.objectStore(DRAFT_STORE_NAME).delete(templateId);
  } catch (e) {
    if (typeof window !== "undefined") {
      localStorage.removeItem(`marasim_draft_${templateId}`);
    }
  }
}

// ==========================================
// 📷 OFFLINE MEDIA & GPS HELPERS
// ==========================================

export async function getCurrentGPS(): Promise<{ lat: number; lng: number } | null> {
  if (typeof window === "undefined" || !("geolocation" in navigator)) {
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        });
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });
}
