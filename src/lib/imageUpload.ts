// 아바타/로고 이미지 업로드 헬퍼
// - Storage 버킷: avatars (public, max 5MB, image/* 허용)
// - 클라이언트 사이드 리사이즈로 400x400 정사각 JPEG 변환 후 업로드
// - 같은 경로면 덮어쓰기, 캐시 무효화 위해 ?v=timestamp 쿼리 부착
import { supabase } from "./supabase";

const AVATAR_BUCKET = "avatars";
const DEFAULT_MAX_SIZE = 400;
const MAX_INPUT_BYTES = 10 * 1024 * 1024; // 입력 10MB 까지 허용 (리사이즈 후 5MB 미만이면 OK)

/** 이미지를 정사각으로 center-crop 한 뒤 maxSize 로 리사이즈, JPEG Blob 반환 */
export function resizeImage(file: File, maxSize = DEFAULT_MAX_SIZE): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        const size = Math.min(side, maxSize);
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas 2D context 를 사용할 수 없습니다"));
          return;
        }
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (blob) resolve(blob);
            else reject(new Error("이미지 인코딩에 실패했습니다"));
          },
          "image/jpeg",
          0.85,
        );
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 불러올 수 없습니다"));
    };
    img.src = url;
  });
}

/**
 * avatars 버킷에 이미지 업로드. 절대 public URL 반환 (캐시 무효화 쿼리 포함).
 * @param file       사용자가 선택한 원본 파일
 * @param basePath   확장자를 뺀 저장 경로 (예: "profiles/abc-uuid", "members/m-123")
 * @param maxSize    리사이즈 한 변 길이 (기본 400)
 */
export async function uploadAvatar(file: File, basePath: string, maxSize = DEFAULT_MAX_SIZE): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("이미지 파일만 업로드 가능합니다");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("파일이 너무 큽니다 (10MB 이하)");
  }

  const blob = await resizeImage(file, maxSize);
  const path = `${basePath}.jpg`;

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, blob, {
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: "3600",
    });
  if (error) throw error;

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

/** 업로드된 아바타 삭제 */
export async function deleteAvatar(basePath: string): Promise<void> {
  await supabase.storage.from(AVATAR_BUCKET).remove([`${basePath}.jpg`]);
}
