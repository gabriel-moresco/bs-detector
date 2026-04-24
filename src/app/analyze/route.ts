import { extractCitations } from "@/lib/agents/citation-extractor"
import { verifyAuthorities } from "@/lib/agents/authority-verifier"
import { verifyQuotes } from "@/lib/agents/quote-verifier"
import { extractClaims } from "@/lib/agents/claim-extractor"
import { checkCrossDocConsistency } from "@/lib/agents/cross-doc-checker"
import { generateJudicialMemo } from "@/lib/agents/judicial-memo"
import { loadMSJ, loadSupportingDocs } from "@/lib/documents"
import { logger } from "@/lib/logger"
import { withRetry } from "@/lib/retry"

import type { Citation } from "@/lib/agents/citation-extractor/schema"
import type { VerificationResult } from "@/lib/agents/authority-verifier"
import type { QuoteVerificationResult } from "@/lib/agents/quote-verifier"
import type { ClaimCheckResult } from "@/lib/agents/cross-doc-checker"

type StageError = { stage: string; error: string }

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export async function POST() {
  const startedAt = Date.now()

  const report: Record<string, unknown> = {}
  const errors: StageError[] = []

  let citations: Citation[] | null = null
  let msj: string

  try {
    msj = await loadMSJ()
  } catch (err) {
    const msg = errorMessage(err)
    logger.warn("pipeline", `load-msj failed: ${msg}`)
    logger.pipelineDone(Date.now() - startedAt)
    return Response.json(
      { errors: [{ stage: "load-msj", error: msg }] },
      { status: 500 }
    )
  }

  // Stage 1: extractors + supporting-docs load run in parallel (no interdependencies)
  const citationsPromise = withRetry(() => extractCitations(msj), {
    tag: "citation-extractor",
  })
    .then((result) => {
      citations = result
      report.citations = result
      return result
    })
    .catch((err) => {
      const msg = errorMessage(err)
      logger.warn("pipeline", `citation-extractor failed: ${msg}`)
      errors.push({ stage: "citation-extractor", error: msg })
      return null
    })

  const claimsPromise = withRetry(() => extractClaims(msj), {
    tag: "claim-extractor",
  })
    .then((result) => {
      report.claims = result
      return result
    })
    .catch((err) => {
      const msg = errorMessage(err)
      logger.warn("pipeline", `claim-extractor failed: ${msg}`)
      errors.push({ stage: "claim-extractor", error: msg })
      return null
    })

  const supportingDocsPromise = loadSupportingDocs().catch((err) => {
    const msg = errorMessage(err)
    logger.warn("pipeline", `load-supporting-docs failed: ${msg}`)
    errors.push({ stage: "load-supporting-docs", error: msg })
    return null
  })

  // Stage 2: downstream agents start as soon as their dependencies resolve.
  // authority-verifier + quote-verifier fire when citations are ready.
  // cross-doc-checker fires when claims + supporting docs are ready.
  const verifiersPromise = citationsPromise.then(async (cits) => {
    if (!cits) return

    const [authSettled, quoteSettled] = await Promise.allSettled([
      withRetry(() => verifyAuthorities(cits), { tag: "authority-verifier" }),
      withRetry(() => verifyQuotes(cits), { tag: "quote-verifier" }),
    ])

    if (authSettled.status === "fulfilled") {
      report.verifications = authSettled.value
    } else {
      const msg = errorMessage(authSettled.reason)
      logger.warn("pipeline", `authority-verifier failed: ${msg}`)
      errors.push({ stage: "authority-verifier", error: msg })
    }

    if (quoteSettled.status === "fulfilled") {
      report.quoteVerifications = quoteSettled.value
    } else {
      const msg = errorMessage(quoteSettled.reason)
      logger.warn("pipeline", `quote-verifier failed: ${msg}`)
      errors.push({ stage: "quote-verifier", error: msg })
    }
  })

  const crossDocPromise = Promise.all([
    claimsPromise,
    supportingDocsPromise,
  ]).then(async ([extractedClaims, supportingDocs]) => {
    if (!extractedClaims || !supportingDocs) return

    try {
      report.crossDocResults = await withRetry(
        () => checkCrossDocConsistency(extractedClaims, supportingDocs),
        { tag: "cross-doc-checker" }
      )
    } catch (err) {
      const msg = errorMessage(err)
      logger.warn("pipeline", `cross-doc-checker failed: ${msg}`)
      errors.push({ stage: "cross-doc-checker", error: msg })
    }
  })

  await Promise.all([verifiersPromise, crossDocPromise])

  // Stage 3: judicial memo synthesizes all findings
  try {
    const memoResult = await withRetry(
      () =>
        generateJudicialMemo({
          verifications: report.verifications as
            | VerificationResult[]
            | undefined,
          quoteVerifications: report.quoteVerifications as
            | QuoteVerificationResult[]
            | undefined,
          crossDocResults: report.crossDocResults as
            | ClaimCheckResult[]
            | undefined,
        }),
      { tag: "judicial-memo" }
    )
    report.judicialMemo = memoResult
  } catch (err) {
    const msg = errorMessage(err)
    logger.warn("pipeline", `judicial-memo failed: ${msg}`)
    errors.push({ stage: "judicial-memo", error: msg })
  }

  if (errors.length > 0) {
    report.errors = errors
  }

  logger.pipelineDone(Date.now() - startedAt)

  const status = citations ? 200 : 500
  return Response.json(report, { status })
}
