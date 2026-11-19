import { Upload } from "./Upload.js";
import { UploadGrant } from "./UploadGrant.js";
import { UploadQuota } from "./UploadQuota.js";
export async function initializeUploadModels() {
  await Promise.all([
    Upload.createIndexes(),
    UploadGrant.createIndexes(),
    UploadQuota.createIndexes(),
  ]);
}
