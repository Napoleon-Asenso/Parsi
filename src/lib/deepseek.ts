import OpenAI from "openai";
import { DEEPSEEK_CONFIG } from "@/config/ai.config";

/**
 * Factory for the official OpenAI SDK client configured specifically
 * to point to DeepSeek's API endpoint (https://api.deepseek.com).
 * All parameters are strictly sourced from DEEPSEEK_CONFIG.
 */
export function getDeepSeekClient(): OpenAI {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY environment variable is missing.");
  }

  return new OpenAI({
    apiKey,
    baseURL: DEEPSEEK_CONFIG.baseUrl,
    timeout: DEEPSEEK_CONFIG.summarization.timeoutMs,
  });
}
