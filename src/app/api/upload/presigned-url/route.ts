import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MAX_FILE_SIZE_BYTES, generatePresignedUploadUrl } from "@/lib/storage";
import { DEFAULT_USER_ID } from "@/lib/user";

const UploadRequestSchema = z.object({
  fileName: z.string().min(1, "fileName is required"),
  fileType: z.string().min(1, "fileType is required"),
  fileSize: z.number().int().positive("fileSize must be a positive integer"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = UploadRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload",
          code: "BAD_REQUEST",
          details: parsed.error.format(),
        },
        { status: 400 }
      );
    }

    const { fileName, fileType, fileSize } = parsed.data;

    // Any MIME type is accepted; only the size ceiling is enforced.
    // Size limit check
    if (fileSize > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: `File size exceeds the 10 MB limit (${fileSize} bytes)`,
          code: "FILE_TOO_LARGE",
        },
        { status: 400 }
      );
    }

    const userId = DEFAULT_USER_ID;
    const { uploadUrl, storageKey } = await generatePresignedUploadUrl(
      userId,
      fileName,
      fileType
    );

    return NextResponse.json({ uploadUrl, storageKey }, { status: 200 });
  } catch (err) {
    console.error("Presigned URL generation error:", err);
    return NextResponse.json(
      {
        error: "Failed to generate presigned upload URL",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 }
    );
  }
}
