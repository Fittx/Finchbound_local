import { request } from "./client";
export type UploadResponse = { uploadId: string; url: string };
export function uploadImage(file: File, bearer?: string) {
  const data = new FormData();
  data.append("file", file);
  return request<UploadResponse>("/uploads/image", "POST", data, bearer);
}
export const uploadHostImage = (file: File) => uploadImage(file);
