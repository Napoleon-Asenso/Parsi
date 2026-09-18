---
name: configure-openai-sdk
description: Manage official OpenAI Node SDK integration, enforce strict central configuration parameter sourcing, manage prompt construction, and secure API credentials.
version: 1.0.0
---

# Operational Directives: OpenAI SDK & Central Configuration

## 1. Central Configuration Mandate (`src/config/ai.config.ts`)

ALL OpenAI parameters MUST be imported directly from `src/config/ai.config.ts`[cite: 2]. You are STRICTLY FORBIDDEN from writing inline model names, temperatures, or token caps inside API routes, server actions, or Inngest background functions[cite: 2].

```typescript
// MANDATORY CONFIGURATION MAP
export const AI_CONFIG = {
  parsing: {
    model: "gpt-4o-mini",
    temperature: 0.2,
    maxTokens: 1500,
    timeoutMs: 30000,
    maxRetries: 2,
    detailLevel: "low" as const,
  },
  summarization: {
    model: "gpt-4o-mini",
    temperature: 0.3,
    maxTokens: 500,
    timeoutMs: 15000,
  },
  concurrencyLimit: 3,
} as const;
```
