import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

export const BUCKET_NAME = process.env.AWS_S3_BUCKET || "parsi-receipts";
export const AWS_REGION =
  process.env.AWS_REGION || (process.env.AWS_ENDPOINT ? "auto" : "us-east-1");

export const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "mock-access-key",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "mock-secret-key",
  },
  ...(process.env.AWS_ENDPOINT ? { endpoint: process.env.AWS_ENDPOINT, forcePathStyle: true } : {}),
});

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

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

  return { uploadUrl, storageKey };
}

export async function verifyS3ObjectExists(storageKey: string): Promise<boolean> {
  try {
    const command = new HeadObjectCommand({
      Bucket: BUCKET_NAME,
      Key: storageKey,
    });
    await s3Client.send(command);
    return true;
  } catch (error) {
    return false;
  }
}

export async function getS3ObjectBuffer(storageKey: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: storageKey,
  });
  const response = await s3Client.send(command);
  if (!response.Body) {
    throw new Error(`Empty body returned for S3 object: ${storageKey}`);
  }
  const byteArray = await response.Body.transformToByteArray();
  return Buffer.from(byteArray);
}
