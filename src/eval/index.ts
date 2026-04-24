/**
 * BS Detector — Eval Harness
 *
 * Runs the analysis pipeline against the Rivera v. Harmon case and scores
 * the output against a hand-annotated golden dataset.
 *
 * Usage:
 *   pnpm eval                              # calls the running dev server
 *   pnpm eval -- --snapshot <file.json>    # evaluates a saved snapshot
 *   pnpm eval -- --save <file.json>        # runs pipeline and saves output
 *
 * Requires: dev server running at localhost:3000 (unless using --snapshot)
 */

import { writeFile, readFile, mkdir } from "node:fs/promises"
import path from "node:path"

import {
  EXPECTED_CITATIONS,
  EXPECTED_AUTHORITY_VERDICTS,
  EXPECTED_QUOTE_VERDICTS,
  EXPECTED_CROSS_DOC_FLAWS,
} from "./golden-dataset"

import {
  scoreCitationExtraction,
  scoreAuthorityVerification,
  scoreQuoteVerification,
  scoreCrossDocConsistency,
  computeOverallSummary,
  type PipelineReport,
  type EvalReport,
} from "./scoring"

import { printConsoleReport, buildJsonReport } from "./reporter"

// ---------------------------------------------------------------------------
// Pipeline execution (calls the running dev server)
// ---------------------------------------------------------------------------

const API_URL = process.env.EVAL_API_URL ?? "http://localhost:3000"

async function runPipeline(): Promise<{
  report: PipelineReport
  elapsed_ms: number
}> {
  console.log(`\n  Calling POST ${API_URL}/analyze ...`)
  console.log("  (this may take a few minutes)\n")

  const start = Date.now()

  const res = await fetch(`${API_URL}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  })

  const elapsed_ms = Date.now() - start
  const report = (await res.json()) as PipelineReport

  if (!res.ok && !report.citations) {
    throw new Error(
      `Pipeline returned ${res.status}: ${JSON.stringify(report.errors ?? report)}`
    )
  }

  console.log(`  Pipeline completed in ${(elapsed_ms / 1000).toFixed(1)}s`)
  const stages = [
    report.citations && `${report.citations.length} citations`,
    report.verifications && `${report.verifications.length} verifications`,
    report.quoteVerifications &&
      `${report.quoteVerifications.length} quote checks`,
    report.crossDocResults &&
      `${report.crossDocResults.length} cross-doc checks`,
  ]
    .filter(Boolean)
    .join(", ")
  console.log(`  Results: ${stages}`)

  if (report.errors && report.errors.length > 0) {
    console.log(`  Errors: ${report.errors.map((e) => e.stage).join(", ")}`)
  }

  return { report, elapsed_ms }
}

// ---------------------------------------------------------------------------
// Snapshot I/O
// ---------------------------------------------------------------------------

async function loadSnapshot(filePath: string): Promise<PipelineReport> {
  const raw = await readFile(filePath, "utf-8")
  return JSON.parse(raw) as PipelineReport
}

async function saveSnapshot(
  filePath: string,
  report: PipelineReport
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, JSON.stringify(report, null, 2))
  console.log(`  Snapshot saved to ${filePath}`)
}

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

function parseArgs(): {
  snapshotPath?: string
  savePath?: string
} {
  const args = process.argv.slice(2)
  const result: { snapshotPath?: string; savePath?: string } = {}

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--snapshot" && args[i + 1]) {
      result.snapshotPath = args[++i]
    } else if (args[i] === "--save" && args[i + 1]) {
      result.savePath = args[++i]
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs()

  let pipelineReport: PipelineReport
  let pipelineElapsedMs: number

  if (args.snapshotPath) {
    console.log(`\n  Loading snapshot from ${args.snapshotPath}`)
    pipelineReport = await loadSnapshot(args.snapshotPath)
    pipelineElapsedMs = 0
  } else {
    const result = await runPipeline()
    pipelineReport = result.report
    pipelineElapsedMs = result.elapsed_ms

    const defaultSnapshotPath = path.join(
      "eval-results",
      "latest-snapshot.json"
    )
    await saveSnapshot(defaultSnapshotPath, pipelineReport)

    if (args.savePath) {
      await saveSnapshot(args.savePath, pipelineReport)
    }
  }

  console.log("\n  Scoring against golden dataset...\n")
  const evalStart = Date.now()

  const citationExtraction = scoreCitationExtraction(
    pipelineReport,
    EXPECTED_CITATIONS
  )

  const authorityVerification = scoreAuthorityVerification(
    pipelineReport,
    EXPECTED_AUTHORITY_VERDICTS
  )

  const quoteVerification = scoreQuoteVerification(
    pipelineReport,
    EXPECTED_QUOTE_VERDICTS
  )

  const crossDocConsistency = scoreCrossDocConsistency(
    pipelineReport,
    EXPECTED_CROSS_DOC_FLAWS
  )

  const agents = {
    citation_extraction: citationExtraction,
    authority_verification: authorityVerification,
    quote_verification: quoteVerification,
    cross_doc_consistency: crossDocConsistency,
  }

  const evalReport: EvalReport = {
    timestamp: new Date().toISOString(),
    pipeline_elapsed_ms: pipelineElapsedMs,
    eval_elapsed_ms: Date.now() - evalStart,
    summary: computeOverallSummary(agents),
    agents,
  }

  printConsoleReport(evalReport)

  const resultsDir = "eval-results"
  await mkdir(resultsDir, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const jsonPath = path.join(resultsDir, `eval-${timestamp}.json`)
  await writeFile(jsonPath, buildJsonReport(evalReport))
  console.log(`  Results saved to ${jsonPath}\n`)
}

main().catch((err) => {
  console.error("\n  Eval failed:", err.message ?? err)
  process.exit(1)
})
