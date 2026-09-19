import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

export const BUCKET_NAME = process.env.R2_BUCKET_NAME || "parsi-receipts";

function getR2Endpoint(): string {
  const accountId = process.env.R2_ACCOUNT_ID;
  if (!accountId) {
    throw new Error(
      "R2_ACCOUNT_ID is required. Find it on your Cloudflare R2 overview page."
    );
  }
  return process.env.R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`;
}

function r2Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: getR2Endpoint(),
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || "mock-access-key",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "mock-secret-key",
    },
  });
}

// Any file type is accepted; the only hard limit is the size ceiling below.
export const MAX_FILE_SIZE_LABEL = "10 MB";
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function generatePresignedUploadUrl(
  userId: string,
  fileName: string,
  fileType: string
): Promise<{ uploadUrl: string; storageKey: string }> {
  // Sanitize filename
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const uniqueId = crypto.randomUUID();
  const storageKey = `uploads/${userId}/${uniqueId}-${sanitizedFileName}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: storageKey,
    ContentType: fileType,
  });

  const uploadUrl = await getSignedUrl(r2Client(), command, { expiresIn: 900 });

  return { uploadUrl, storageKey };
}

export async function verifyObjectExists(storageKey: string): Promise<boolean> {
  try {
    const command = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: storageKey,
    });
    await r2Client().send(command);
    return true;
  } catch (error) {
    return false;
  }
}

export async function getObjectBuffer(storageKey: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: storageKey,
  });
  const response = await r2Client().send(command);
  if (!response.Body) {
    throw new Error(`Empty body returned for R2 object: ${storageKey}`);
  }
  const byteArray = await response.Body.transformToByteArray();
  return Buffer.from(byteArray);
}