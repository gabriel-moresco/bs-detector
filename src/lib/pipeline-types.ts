import type { Citation } from "@/lib/agents/citation-extractor/schema"
import type {
  Verdict,
  VerificationResult,
} from "@/lib/agents/authority-verifier"
import type {
  QuoteVerdict,
  QuoteVerificationResult,
  Alteration,
} from "@/lib/agents/quote-verifier"
import type { Claim } from "@/lib/agents/claim-extractor/schema"
import type { ClaimCheckResult } from "@/lib/agents/cross-doc-checker"
import type { MemoResult } from "@/lib/agents/judicial-memo"

export type StageError = { stage: string; error: string }

export type AnalysisReport = {
  citations?: Citation[]
  verifications?: VerificationResult[]
  quoteVerifications?: QuoteVerificationResult[]
  claims?: Claim[]
  crossDocResults?: ClaimCheckResult[]
  judicialMemo?: MemoResult
  errors?: StageError[]
}

export type {
  Citation,
  Verdict,
  VerificationResult,
  QuoteVerdict,
  QuoteVerificationResult,
  Alteration,
  Claim,
  ClaimCheckResult,
  MemoResult,
}
