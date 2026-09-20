import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

/**
 * Dev-only, zero-setup object store.
 *
 * This exists so the full upload -> parse -> result pipeline runs end-to-end
 * in development WITHOUT a real Cloudflare bucket or credentials. Binary bytes
 * are written to the LOCAL FILESYSTEM inside `.local-storage/` — they are NEVER
 * stored in PostgreSQLalert. The database continues to hold only the `storageKey`
 * string, exactly as in the R2 path, so the "zero binary in the database"
 * invariant is preserved identically in both modes.
 *
 * This module is strictly guarded by `useLocalDevStorage()` and can never
 * activate in production (NODE_ENV === "production" forces the real R2 path).
 */

const DEV_STORAGE_ROOT = path.join(process.cwd(), ".local-storage");

/**
 * True in development whenever real R2 credentials are NOT configured.
 * - development + no/excessive mock R2 keys -> local filesystem (zero setup)
 * - development + real R2 keys              -> real Cloudflare R2
 * - production                              -> real Cloudflare R2 (never local)
 */
export function useLocalDevStorage(): boolean {
  const isDev = process.env.NODE_ENV === "development";
  if (!isDev) return false;

  const accountId = process.env.R2_ACCOUNT_ID;
  const hasRealR2 =
    Boolean(accountId) && !accountId?.startsWith("mock") &&
    Boolean(process.env.R2_ACCESS_KEY_ID && !process.env.R2_ACCESS_KEY_ID.startsWith("mock")) &&
    Boolean(process.env.R2_SECRET_ACCESS_KEY && !process.env.R2_SECRET_ACCESS_KEY.startsWith("mock"));

  return !hasRealR2;
}

function toLocalPath(storageKey: string): string {
  const segments = storageKey.split("/").filter(Boolean);
  if (segments.length === 0) {
    throw new Error("Invalid storage key: no path segments");
  }
  const localPath = path.join(DEV_STORAGE_ROOT, ...segments);
  if (!localPath.startsWith(DEV_STORAGE_ROOT + path.sep)) {
    throw new Error(`Unsafe storage key path traversal detected: ${storageKey}`);
  }
  return localPath;
}

export function generateLocalStorageKey(
  userId: string,
  fileName: string
): string {
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const uniqueId = crypto.randomUUID();
  return `uploads/${userId}/${uniqueId}-${sanitized}`;
}

export async function verifyLocalObjectExists(storageKey: string): Promise<boolean> {
  try {
    await fs.access(toLocalPath(storageKey));
    return true;
  } catch {
    return false;
  }
}

export async function getLocalObjectBuffer(storageKey: string): Promise<Buffer> {
  return fs.readFile(toLocalPath(storageKey));
}

/**
 * Dev-only primitive: write binary bytes for a storage key to the LOCAL
 * filesystem. Guaranteed by `useLocalDevStorage()` to only ever run in
 * development; binary NEVER touches PostgreSQLalert in this path either.
 */
export async function writeLocalObject(
  storageKey: string,
  data: Uint8Array
): Promise<void> {
  const localPath = toLocalPath(storageKey);
  await fs.mkdir(path.dirname(localPath), { recursive: true });
  await fs.writeFile(localPath, data);
}
