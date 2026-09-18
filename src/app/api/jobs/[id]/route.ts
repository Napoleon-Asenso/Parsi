import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          error: "Job ID parameter is required",
          code: "MISSING_JOB_ID",
        },
        { status: 400 }
      );
    }

    const job = await db.job.findUnique({
      where: { id },
      include: {
        file: {
          select: {
            id: true,
            storageKey: true,
            fileName: true,
            fileSize: true,
            mimeType: true,
            createdAt: true,
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json(
        {
          error: `Job with ID '${id}' not found`,
          code: "NOT_FOUND",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(job, { status: 200 });
  } catch (err) {
    console.error("Error fetching job:", err);
    return NextResponse.json(
      {
        error: "Failed to fetch job status",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 }
    );
  }
}
