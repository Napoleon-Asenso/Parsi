import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  DEEPSEEK_CONFIG,
  FOLLOWUP_SUMMARIZATION_SYSTEM_PROMPT,
} from "@/config/ai.config";
import OpenAI from "openai";

export async function POST(
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

    // Task 2 Caching mandate: If already summarized, return cached text immediately
    if (job.summaryText) {
      return NextResponse.json(
        { summary: job.summaryText, cached: true },
        { status: 200 }
      );
    }

    // Must be in DONE state with valid resultJson to summarize
    if (job.status !== "DONE" || !job.resultJson) {
      return NextResponse.json(
        {
          error: "Job parsing is not completed yet or failed",
          code: "JOB_NOT_READY",
        },
        { status: 400 }
      );
    }

    // DeepSeek is OpenAI-compatible; the openai SDK is pointed at DeepSeek's
    // base URL with a DeepSeek (paid) API key.
    const deepseek = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: DEEPSEEK_CONFIG.baseUrl,
      timeout: DEEPSEEK_CONFIG.summarization.timeoutMs,
    });

    const completion = await deepseek.chat.completions.create({
      model: DEEPSEEK_CONFIG.summarization.model,
      temperature: DEEPSEEK_CONFIG.summarization.temperature,
      max_tokens: DEEPSEEK_CONFIG.summarization.maxTokens,
      messages: [
        {
          role: "system",
          content: FOLLOWUP_SUMMARIZATION_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: JSON.stringify(job.resultJson, null, 2),
        },
      ],
    });

    const summary = completion.choices?.[0]?.message?.content?.trim() || "";

    // Cache generated summary into database Job record
    await db.job.update({
      where: { id },
      data: {
        summaryText: summary,
      },
    });

    return NextResponse.json({ summary, cached: false }, { status: 200 });
  } catch (err) {
    console.error("Error generating summary:", err);
    return NextResponse.json(
      {
        error: "Failed to generate expense summary",
        code: "INTERNAL_SERVER_ERROR",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
