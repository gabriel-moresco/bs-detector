import { openai, type OpenAIResponsesProviderOptions } from "@ai-sdk/openai"
import { generateText, Output } from "ai"

import type { Claim } from "@/lib/agents/claim-extractor/schema"
import { logger } from "@/lib/logger"
import { SYSTEM_PROMPT } from "./prompt"
import { llmClaimCheckSchema } from "./schema"

const MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini"
const REASONING_EFFORT = process.env.OPENAI_REASONING_EFFORT || "high"

export type ClaimVerdict =
  | "CONSISTENT"
  | "CONTRADICTED"
  | "UNSUPPORTED"
  | "UNVERIFIABLE"

export type Discrepancy = {
  source_document: string
  source_excerpt: string
  type: "DATE" | "FACT" | "OMISSION" | "MISCHARACTERIZATION"
  severity: "MINOR" | "MATERIAL"
  explanation: string
}

export type ClaimCheckResult = {
  claim_id: string
  claim: string
  verdict: ClaimVerdict
  discrepancies: Discrepancy[]
  reasoning: string
}

export type SupportingDoc = {
  name: string
  content: string
}

const TAG = "cross-doc-checker"

function formatDocs(docs: SupportingDoc[]): string {
  return docs
    .map(
      (doc) =>
        `=== ${doc.name} ===\n${doc.content}\n=== end ${doc.name} ===`
    )
    .join("\n\n")
}

async function checkSingleClaim(
  claim: Claim,
  docsText: string
): Promise<ClaimCheckResult> {
  logger.step(TAG, `checking ${claim.id}: "${claim.claim.slice(0, 60)}..."`)
  const startedAt = Date.now()

  const result = await generateText({
    model: openai.responses(MODEL),
    system: SYSTEM_PROMPT,
    prompt:
      `Check the following factual claim from the MSJ against the supporting documents.\n\n` +
      `Claim: "${claim.claim}"\n` +
      `MSJ excerpt: "${claim.msj_excerpt}"\n` +
      `Category: ${claim.category}\n\n` +
      `Supporting documents:\n\n${docsText}`,
    output: Output.object({ schema: llmClaimCheckSchema }),
    providerOptions: {
      openai: {
        reasoningEffort: REASONING_EFFORT,
      } satisfies OpenAIResponsesProviderOptions,
    },
  })

  if (result.warnings && result.warnings.length > 0) {
    logger.warn(TAG, `${claim.id}: ${JSON.stringify(result.warnings)}`)
  }

  if (result.finishReason !== "stop") {
    logger.warn(
      TAG,
      `${claim.id}: non-stop finishReason: ${result.finishReason}`
    )
  }

  const elapsedMs = Date.now() - startedAt
  logger.step(
    TAG,
    `${claim.id} -> ${result.output.analysis.verdict} (${(elapsedMs / 1000).toFixed(2)}s)`
  )

  return {
    claim_id: claim.id,
    claim: claim.claim,
    verdict: result.output.analysis.verdict,
    discrepancies: result.output.analysis.discrepancies,
    reasoning: result.output.analysis.reasoning,
  }
}

export async function checkCrossDocConsistency(
  claims: Claim[],
  supportingDocs: SupportingDoc[]
): Promise<ClaimCheckResult[]> {
  logger.stageStart(TAG)
  const startedAt = Date.now()

  logger.step(
    TAG,
    `${claims.length} claims to check against ${supportingDocs.length} documents`
  )

  const docsText = formatDocs(supportingDocs)

  const promises = claims.map(
    async (claim): Promise<ClaimCheckResult> => checkSingleClaim(claim, docsText)
  )

  const settled = await Promise.allSettled(promises)

  const results: ClaimCheckResult[] = settled.map((s, i) => {
    if (s.status === "fulfilled") return s.value
    logger.warn(TAG, `${claims[i].id} failed: ${s.reason}`)
    return {
      claim_id: claims[i].id,
      claim: claims[i].claim,
      verdict: "UNVERIFIABLE" as const,
      discrepancies: [],
      reasoning: `Verification failed: ${s.reason}`,
    }
  })

  const elapsedMs = Date.now() - startedAt
  const verdictCounts = results.reduce(
    (acc, r) => {
      acc[r.verdict] = (acc[r.verdict] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const summary = Object.entries(verdictCounts)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ")
  logger.stageEnd(TAG, elapsedMs, summary)

  return results
}
