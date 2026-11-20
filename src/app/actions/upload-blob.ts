"use server";

import { put } from "@vercel/blob";

export interface UploadImageResult {
  success: boolean;
  url?: string;
  isBlob: boolean;
  error?: string;
}

/**
 * Server Action: Uploads compressed image to Vercel Blob.
 * If BLOB_READ_WRITE_TOKEN is missing (local dev/offline/no token),
 * it gracefully falls back to returning the inline base64 string so the app never fails!
 */
export async function uploadImageAction(
  base64Data: string,
  filenamePrefix = "marasim_photo"
): Promise<UploadImageResult> {
  try {
    if (!base64Data || typeof base64Data !== "string") {
      return { success: false, isBlob: false, error: "بيانات الصورة غير صالحة" };
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;

    // If token is missing, fall back to inline base64 cleanly
    if (!token) {
      return {
        success: true,
        url: base64Data,
        isBlob: false,
      };
    }

    // Convert Base64 dataURL to buffer
    const commaIndex = base64Data.indexOf(",");
    const rawBase64 = commaIndex > -1 ? base64Data.slice(commaIndex + 1) : base64Data;
    const buffer = Buffer.from(rawBase64, "base64");

    const mimeMatch = base64Data.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/webp";
    const extension = mimeType.includes("webp") ? "webp" : "jpg";
    const filename = `${filenamePrefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${extension}`;

    const blob = await put(filename, buffer, {
      access: "public",
      contentType: mimeType,
      token,
    });

    return {
      success: true,
      url: blob.url,
      isBlob: true,
    };
  } catch (err: any) {
    console.warn("Vercel Blob upload failed, falling back to inline base64:", err?.message);
    // Even if upload network fails, fall back to base64 so user data is NEVER lost!
    return {
      success: true,
      url: base64Data,
      isBlob: false,
    };
  }
}
