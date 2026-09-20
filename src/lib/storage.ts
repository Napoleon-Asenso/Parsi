import {
  generatePresignedUploadUrl as r2GeneratePresignedUploadUrl,
  verifyObjectExists as r2VerifyObjectExists,
  getObjectBuffer as r2GetObjectBuffer,
} from "./r2";
import {
  useLocalDevStorage,
  generateLocalStorageKey,
  verifyLocalObjectExists,
  getLocalObjectBuffer,
} from "./localStorage";

export { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_LABEL } from "./r2";

/**
 * Storage dispatcher facade.
 *
 * Consumers (presigned route, worker, dropzone) import ONLY from this module.
 * It routes upload + object-read operations to one of two backends exposing the
 * same call shape:
 *
 * - local-dev (zero setup)  -> `.local-storage/` on the local filesystem
 * - production / real R2    -> Cloudflare R2 (S3-protocol presigned URLs)
 *
 * Binary bytes NEVER enter PostgreSQL in either mode; the database holds only
 * the `storageKey` string. Invariant preserved identically in both modes.
 */
export function generatePresignedUploadUrl(
  userId: string,
  fileName: string,
  fileType: string
): Promise<{ uploadUrl: string; storageKey: string }> {
  if (useLocalDevStorage()) {
    const storageKey = generateLocalStorageKey(userId, fileName);
    const uploadUrl = `/api/upload/dev?storageKey=${encodeURIComponent(storageKey)}`;
    return Promise.resolve({ uploadUrl, storageKey });
  }
  return r2GeneratePresignedUploadUrl(userId, fileName, fileType);
}

export function verifyObjectExists(storageKey: string): Promise<boolean> {
  if (useLocalDevStorage()) {
    return verifyLocalObjectExists(storageKey);
  }
  return r2VerifyObjectExists(storageKey);
}

export function getObjectBuffer(storageKey: string): Promise<Buffer> {
  if (useLocalDevStorage()) {
    return getLocalObjectBuffer(storageKey);
  }
  return r2GetObjectBuffer(storageKey);
}
