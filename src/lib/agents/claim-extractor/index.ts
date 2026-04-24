import { openai, type OpenAIResponsesProviderOptions } from "@ai-sdk/openai"
import { generateText, Output } from "ai"

import { logger } from "@/lib/logger"
import { SYSTEM_PROMPT } from "./prompt"
import { claimListSchema, type Claim } from "./schema"

const MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini"
const REASONING_EFFORT = process.env.OPENAI_REASONING_EFFORT || "medium"

const TAG = "claim-extractor"

export async function extractClaims(msjText: string): Promise<Claim[]> {
  logger.stageStart(TAG)
  logger.step(TAG, "calling LLM...")
  const startedAt = Date.now()

  const result = await generateText({
    model: openai.responses(MODEL),
    system: SYSTEM_PROMPT,
    prompt: `Extract every verifiable factual claim from the following Motion for Summary Judgment:\n\n${msjText}`,
    output: Output.object({ schema: claimListSchema }),
    providerOptions: {
      openai: {
        reasoningEffort: REASONING_EFFORT,
      } satisfies OpenAIResponsesProviderOptions,
    },
  })

  if (result.warnings && result.warnings.length > 0) {
    logger.warn(TAG, `warnings: ${JSON.stringify(result.warnings)}`)
  }

  if (result.finishReason !== "stop") {
    logger.warn(TAG, `non-stop finishReason: ${result.finishReason}`)
  }

  logger.stageEnd(
    TAG,
    Date.now() - startedAt,
    `extracted ${result.output.claims.length} claims`
  )

  return result.output.claims
}
