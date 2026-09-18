import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { inngest } from "@/inngest/client";
import { DEFAULT_USER_ID, ensureDefaultUser } from "@/lib/user";

const CreateJobSchema = z.object({
  storageKey: z.string().min(1, "storageKey is required"),
  fileName: z.string().min(1, "fileName is required"),
  fileSize: z.number().int().positive("fileSize must be positive"),
  mimeType: z.string().min(1, "mimeType is required"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateJobSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid job creation payload",
          code: "BAD_REQUEST",
          details: parsed.error.format(),
        },
        { status: 400 }
      );
    }

    const { storageKey, fileName, fileSize, mimeType } = parsed.data;

    // Check development mode forced failure flag
    const forceFailureHeader = req.headers.get("x-test-force-failure");
    const isDev = process.env.NODE_ENV === "development";
    const forceFailure = isDev && (forceFailureHeader === "true" || forceFailureHeader === "1");

    await ensureDefaultUser();

    // 1. Create File record (strictly metadata and storageKey, zero binary data)
    const file = await db.file.create({
      data: {
        userId: DEFAULT_USER_ID,
        storageKey,
        fileName,
        fileSize,
        mimeType,
      },
    });

    // 2. Create Job record in PENDING state
    const job = await db.job.create({
      data: {
        userId: DEFAULT_USER_ID,
        fileId: file.id,
        status: "PENDING",
        attempts: 0,
      },
    });

    // 3. Emit Inngest background event
    try {
      await inngest.send({
        name: "expense/job.created",
        data: {
          jobId: job.id,
          storageKey,
          mimeType,
          fileName,
          forceFailure,
        },
      });
    } catch (inngestErr) {
      console.error("Failed to send Inngest event:", inngestErr);
      // In development if inngest server is not connected, we still return the job
    }

    // Return 202 Accepted per technical spec
    return NextResponse.json(
      {
        jobId: job.id,
        status: job.status,
      },
      { status: 202 }
    );
  } catch (err) {
    console.error("Error creating job:", err);
    return NextResponse.json(
      {
        error: "Failed to create processing job",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 }
    );
  }
}
