"use client"

import { useState, useCallback } from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
  CardFooter,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { JsonViewerDialog } from "@/components/json-viewer-dialog"
import { cn } from "@/lib/utils"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  SourceCodeIcon,
  JusticeScale01Icon,
  Alert01Icon,
  DangerIcon,
  LegalDocument01Icon,
  PlayCircle02Icon,
  Copy01Icon,
  CopyCheckIcon,
} from "@hugeicons/core-free-icons"

import type {
  AnalysisReport,
  Citation,
  VerificationResult,
  QuoteVerificationResult,
  Verdict,
  QuoteVerdict,
  Claim,
  MemoResult,
} from "@/lib/pipeline-types"

// ---------------------------------------------------------------------------
// Verdict styling
// ---------------------------------------------------------------------------

const VERDICT_CONFIG: Record<
  Verdict,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  SUPPORTS: { label: "Supports", variant: "secondary" },
  MISREPRESENTS: { label: "Misrepresents", variant: "destructive" },
  LIKELY_FABRICATED: { label: "Likely Fabricated", variant: "destructive" },
  UNVERIFIABLE: { label: "Unverifiable", variant: "outline" },
}

const QUOTE_VERDICT_CONFIG: Record<
  QuoteVerdict,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  ACCURATE: { label: "Accurate", variant: "secondary" },
  ALTERED: { label: "Altered", variant: "destructive" },
  NOT_FOUND: { label: "Not Found", variant: "destructive" },
  UNVERIFIABLE: { label: "Unverifiable", variant: "outline" },
}

const VERDICT_SEVERITY: Record<string, number> = {
  MISREPRESENTS: 0,
  LIKELY_FABRICATED: 1,
  ALTERED: 2,
  NOT_FOUND: 3,
  UNVERIFIABLE: 4,
  SUPPORTS: 5,
  ACCURATE: 6,
}

// ---------------------------------------------------------------------------
// Summary stats
// ---------------------------------------------------------------------------

function SummaryStats({ report }: { report: AnalysisReport }) {
  const citations = report.citations ?? []
  const verifications = report.verifications ?? []
  const quotes = report.quoteVerifications ?? []
  const claims = report.claims ?? []

  const verdictCounts = verifications.reduce(
    (acc, v) => {
      acc[v.verdict] = (acc[v.verdict] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const quoteCounts = quotes.reduce(
    (acc, q) => {
      acc[q.verdict] = (acc[q.verdict] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const stats = [
    { label: "Citations", value: citations.length, emphasis: false },
    { label: "Claims", value: claims.length, emphasis: false },
    {
      label: "Supports",
      value: verdictCounts["SUPPORTS"] ?? 0,
      emphasis: false,
    },
    {
      label: "Misrepresents",
      value: verdictCounts["MISREPRESENTS"] ?? 0,
      emphasis: (verdictCounts["MISREPRESENTS"] ?? 0) > 0,
    },
    {
      label: "Fabricated",
      value: verdictCounts["LIKELY_FABRICATED"] ?? 0,
      emphasis: (verdictCounts["LIKELY_FABRICATED"] ?? 0) > 0,
    },
    {
      label: "Unverifiable",
      value: verdictCounts["UNVERIFIABLE"] ?? 0,
      emphasis: false,
    },
    {
      label: "Quotes OK",
      value: quoteCounts["ACCURATE"] ?? 0,
      emphasis: false,
    },
    {
      label: "Altered",
      value: quoteCounts["ALTERED"] ?? 0,
      emphasis: (quoteCounts["ALTERED"] ?? 0) > 0,
    },
  ]

  return (
    <div className="grid grid-cols-4 gap-px bg-border md:grid-cols-8">
      {stats.map((s) => (
        <div
          key={s.label}
          className="flex flex-col items-center gap-0.5 bg-background px-3 py-3"
        >
          <span
            className={cn(
              "text-lg font-semibold tabular-nums",
              s.emphasis && "text-destructive"
            )}
          >
            {s.value}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {s.label}
          </span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Citation finding card
// ---------------------------------------------------------------------------

function CitationCard({
  citation,
  verification,
  quoteVerification,
  onViewJson,
}: {
  citation: Citation
  verification?: VerificationResult
  quoteVerification?: QuoteVerificationResult
  onViewJson: () => void
}) {
  const verdict = verification?.verdict
  const config = verdict ? VERDICT_CONFIG[verdict] : null
  const quoteConfig = quoteVerification
    ? QUOTE_VERDICT_CONFIG[quoteVerification.verdict]
    : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 flex-wrap">
          <span className="text-muted-foreground font-normal text-xs">
            {citation.id}
          </span>
          <span>{citation.case_name}</span>
          {config && <Badge variant={config.variant}>{config.label}</Badge>}
          {quoteConfig && (
            <Badge variant={quoteConfig.variant}>
              Quote: {quoteConfig.label}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {citation.reporter_citation}
          {citation.year ? ` (${citation.year})` : ""}
          {citation.pincite ? `, at ${citation.pincite}` : ""}
          {citation.signal ? ` — Signal: ${citation.signal}` : ""}
        </CardDescription>
        <CardAction>
          <Button variant="ghost" size="icon-xs" onClick={onViewJson}>
            <HugeiconsIcon icon={SourceCodeIcon} />
            <span className="sr-only">View JSON</span>
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Proposition
          </span>
          <p className="text-foreground">{citation.proposition}</p>
        </div>

        {citation.direct_quote && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Direct Quote
            </span>
            <blockquote className="border-l-2 border-muted-foreground/30 pl-3 italic text-muted-foreground">
              &ldquo;{citation.direct_quote}&rdquo;
            </blockquote>
          </div>
        )}

        {verification && (
          <Collapsible>
            <CollapsibleTrigger className="group flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                className="size-3 transition-transform group-data-[state=closed]:-rotate-90"
              />
              Authority Verification
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 flex flex-col gap-2">
              <p>{verification.reasoning}</p>
              {verification.evidence_excerpt && (
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Evidence Excerpt
                  </span>
                  <blockquote className="border-l-2 border-primary/40 pl-3 text-muted-foreground">
                    {verification.evidence_excerpt}
                  </blockquote>
                </div>
              )}
              {verification.courtlistener_url && (
                <a
                  href={verification.courtlistener_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-3 hover:text-primary/80 text-[11px]"
                >
                  View on CourtListener
                </a>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        {quoteVerification && (
          <Collapsible>
            <CollapsibleTrigger className="group flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                className="size-3 transition-transform group-data-[state=closed]:-rotate-90"
              />
              Quote Verification
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 flex flex-col gap-2">
              <p>{quoteVerification.reasoning}</p>
              {quoteVerification.original_text && (
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Original Text
                  </span>
                  <blockquote className="border-l-2 border-primary/40 pl-3 text-muted-foreground">
                    &ldquo;{quoteVerification.original_text}&rdquo;
                  </blockquote>
                </div>
              )}
              {quoteVerification.alterations.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Alterations
                  </span>
                  {quoteVerification.alterations.map((alt, i) => (
                    <div
                      key={i}
                      className="flex flex-col gap-0.5 rounded-none border border-border bg-muted/30 p-2"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {alt.type}
                        </Badge>
                        {alt.changes_meaning && (
                          <Badge variant="destructive" className="text-[10px]">
                            changes meaning
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                        <div>
                          <span className="text-muted-foreground">Brief: </span>
                          <span className="text-destructive">
                            {alt.brief_version}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Original:{" "}
                          </span>
                          <span>{alt.original_version}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>

      <CardFooter className="text-[10px] text-muted-foreground gap-2">
        <span>§ {citation.location.section}</span>
        <span>¶ {citation.location.paragraph_index}</span>
        {citation.is_back_reference && (
          <Badge variant="outline" className="text-[10px]">
            back-ref
          </Badge>
        )}
      </CardFooter>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Standalone quote card (for the Quotes tab)
// ---------------------------------------------------------------------------

function QuoteCard({
  quoteVerification,
  citation,
  onViewJson,
}: {
  quoteVerification: QuoteVerificationResult
  citation?: Citation
  onViewJson: () => void
}) {
  const config = QUOTE_VERDICT_CONFIG[quoteVerification.verdict]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 flex-wrap">
          <span className="text-muted-foreground font-normal text-xs">
            {quoteVerification.citation_id}
          </span>
          {citation && <span>{citation.case_name}</span>}
          <Badge variant={config.variant}>{config.label}</Badge>
        </CardTitle>
        {citation && (
          <CardDescription>
            {citation.reporter_citation}
            {citation.year ? ` (${citation.year})` : ""}
          </CardDescription>
        )}
        <CardAction>
          <Button variant="ghost" size="icon-xs" onClick={onViewJson}>
            <HugeiconsIcon icon={SourceCodeIcon} />
            <span className="sr-only">View JSON</span>
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Quote in Brief
          </span>
          <blockquote className="border-l-2 border-muted-foreground/30 pl-3 italic text-muted-foreground">
            &ldquo;{quoteVerification.quote}&rdquo;
          </blockquote>
        </div>

        {quoteVerification.original_text && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Original Text
            </span>
            <blockquote className="border-l-2 border-primary/40 pl-3 text-muted-foreground">
              &ldquo;{quoteVerification.original_text}&rdquo;
            </blockquote>
          </div>
        )}

        <p>{quoteVerification.reasoning}</p>

        {quoteVerification.alterations.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Alterations
            </span>
            {quoteVerification.alterations.map((alt, i) => (
              <div
                key={i}
                className="flex flex-col gap-0.5 border border-border bg-muted/30 p-2"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {alt.type}
                  </Badge>
                  {alt.changes_meaning && (
                    <Badge variant="destructive" className="text-[10px]">
                      changes meaning
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                  <div>
                    <span className="text-muted-foreground">Brief: </span>
                    <span className="text-destructive">
                      {alt.brief_version}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Original: </span>
                    <span>{alt.original_version}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Claims section
// ---------------------------------------------------------------------------

function ClaimCard({
  claim,
  onViewJson,
}: {
  claim: Claim
  onViewJson: () => void
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 flex-wrap">
          <span className="text-muted-foreground font-normal text-xs">
            {claim.id}
          </span>
          <Badge variant="outline">{claim.category}</Badge>
        </CardTitle>
        <CardAction>
          <Button variant="ghost" size="icon-xs" onClick={onViewJson}>
            <HugeiconsIcon icon={SourceCodeIcon} />
            <span className="sr-only">View JSON</span>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-foreground">{claim.claim}</p>
        <Collapsible>
          <CollapsibleTrigger className="group flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              className="size-3 transition-transform group-data-[state=closed]:-rotate-90"
            />
            MSJ Excerpt
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <blockquote className="border-l-2 border-muted-foreground/30 pl-3 text-muted-foreground italic">
              {claim.msj_excerpt}
            </blockquote>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
      <CardFooter className="text-[10px] text-muted-foreground gap-2">
        <span>§ {claim.location.section}</span>
        <span>¶ {claim.location.paragraph_index}</span>
      </CardFooter>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Judicial memo
// ---------------------------------------------------------------------------

function JudicialMemoCard({ memo }: { memo: MemoResult }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(memo.memo).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [memo.memo])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Judicial Memo</CardTitle>
        <CardDescription>
          Synthesized from {memo.findingsUsed}{" "}
          {memo.findingsUsed === 1 ? "finding" : "findings"}
        </CardDescription>
        <CardAction>
          <Button variant="ghost" size="icon-xs" onClick={handleCopy}>
            <HugeiconsIcon icon={copied ? CopyCheckIcon : Copy01Icon} />
            <span className="sr-only">Copy memo</span>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-sm/relaxed text-foreground">{memo.memo}</p>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ReportSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-4 gap-px bg-border md:grid-cols-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-1.5 bg-background px-3 py-3"
          >
            <Skeleton className="h-5 w-8" />
            <Skeleton className="h-2.5 w-12" />
          </div>
        ))}
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-3 w-40" />
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Error display
// ---------------------------------------------------------------------------

function PipelineErrors({
  errors,
}: {
  errors: { stage: string; error: string }[]
}) {
  return (
    <div className="flex flex-col gap-2">
      {errors.map((e, i) => (
        <div
          key={i}
          className="flex items-start gap-2 border border-destructive/30 bg-destructive/5 p-3"
        >
          <HugeiconsIcon
            icon={Alert01Icon}
            className="size-4 text-destructive shrink-0 mt-0.5"
          />
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wider font-medium text-destructive">
              {e.stage}
            </span>
            <span className="text-xs text-muted-foreground">{e.error}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Page() {
  const [report, setReport] = useState<AnalysisReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState<number | null>(null)
  const [completedAt, setCompletedAt] = useState<Date | null>(null)

  const [jsonDialog, setJsonDialog] = useState<{
    open: boolean
    title: string
    description?: string
    data: unknown
  }>({ open: false, title: "", data: null })

  const runAnalysis = useCallback(async () => {
    setLoading(true)
    setError(null)
    setReport(null)
    setElapsed(null)
    setCompletedAt(null)

    const start = Date.now()

    try {
      const res = await fetch("/analyze", { method: "POST" })
      const data = await res.json()
      setElapsed(Date.now() - start)
      setCompletedAt(new Date())

      if (!res.ok && !data.citations) {
        setError(
          data.errors?.[0]?.error ?? `Request failed with status ${res.status}`
        )
        return
      }

      setReport(data as AnalysisReport)
    } catch (err) {
      setElapsed(Date.now() - start)
      setError(err instanceof Error ? err.message : "Network error")
    } finally {
      setLoading(false)
    }
  }, [])

  const openJson = (title: string, description: string, data: unknown) =>
    setJsonDialog({ open: true, title, description, data })

  const sortedCitations = report?.citations
    ? [...report.citations].sort((a, b) => {
        const va = report.verifications?.find(
          (v) => v.citation_id === a.id
        )?.verdict
        const vb = report.verifications?.find(
          (v) => v.citation_id === b.id
        )?.verdict
        return (
          (VERDICT_SEVERITY[va ?? "SUPPORTS"] ?? 99) -
          (VERDICT_SEVERITY[vb ?? "SUPPORTS"] ?? 99)
        )
      })
    : []

  return (
    <div className="min-h-svh flex flex-col">
      {/* ---- Header ---- */}
      <header className="border-b border-border">
        <div className="mx-auto max-w-4xl px-4 py-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <HugeiconsIcon
                icon={JusticeScale01Icon}
                className="size-4 text-muted-foreground"
              />
              <h1 className="text-lg font-semibold tracking-tight">
                BS Detector
              </h1>
            </div>
            <p className="text-xs text-muted-foreground">
              Legal brief verification pipeline
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={runAnalysis}
              disabled={loading}
              size="sm"
              className="w-36"
            >
              {loading ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Analyzing…
                </>
              ) : (
                <>
                  <HugeiconsIcon
                    icon={PlayCircle02Icon}
                    data-icon="inline-start"
                  />
                  {report ? "Rerun Analysis" : "Run Analysis"}
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* ---- Content ---- */}
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-6 flex flex-col gap-6">
          {/* Initial empty state */}
          {!report && !loading && !error && (
            <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
              <HugeiconsIcon
                icon={LegalDocument01Icon}
                className="size-5 text-muted-foreground/40"
              />
              <div className="flex flex-col items-center gap-4">
                <div className="flex flex-col gap-1 items-center">
                  <p className="text-sm text-muted-foreground">
                    Ready to analyze.
                  </p>
                  <p className="text-xs text-muted-foreground/60">
                    The pipeline extracts citations, verifies authorities, checks
                    quotes, and extracts factual claims from a legal brief.
                  </p>
                </div>
                <Button onClick={runAnalysis} disabled={loading} size="sm" className="w-32">
                  <HugeiconsIcon
                    icon={PlayCircle02Icon}
                    data-icon="inline-start"
                  />
                  Run Analysis
                </Button>
              </div>
            </div>
          )}

          {/* Error */}
          {error && !report && (
            <div className="flex items-start gap-2 border border-destructive/30 bg-destructive/5 p-4">
              <HugeiconsIcon
                icon={DangerIcon}
                className="size-4 text-destructive shrink-0 mt-0.5"
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-destructive">
                  Pipeline failed
                </span>
                <span className="text-xs text-muted-foreground">{error}</span>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <>
              <p className="text-xs text-muted-foreground text-center">
                The pipeline is running — this may take a few minutes.
              </p>
              <ReportSkeleton />
            </>
          )}

          {/* Report */}
          {report && (
            <>
              {/* Elapsed time + full JSON button */}
              <div className="flex items-center justify-between">
                {elapsed != null && (
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
                    Completed in {(elapsed / 1000).toFixed(1)}s
                    {completedAt && (
                      <span>
                        {" "}
                        at{" "}
                        {completedAt.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </p>
                )}
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() =>
                    openJson(
                      "Full Report JSON",
                      "Complete pipeline output",
                      report
                    )
                  }
                >
                  <HugeiconsIcon
                    icon={SourceCodeIcon}
                    data-icon="inline-start"
                  />
                  Full JSON
                </Button>
              </div>

              {/* Partial errors */}
              {report.errors && report.errors.length > 0 && (
                <PipelineErrors errors={report.errors} />
              )}

              {/* Summary */}
              <SummaryStats report={report} />

              {/* Judicial Memo */}
              {report.judicialMemo && (
                <JudicialMemoCard memo={report.judicialMemo} />
              )}

              {/* Tabbed results */}
              <Tabs defaultValue="citations">
                <TabsList>
                  <TabsTrigger value="citations">
                    Citations ({sortedCitations.length})
                  </TabsTrigger>
                  <TabsTrigger value="quotes">
                    Quotes ({report.quoteVerifications?.length ?? 0})
                  </TabsTrigger>
                  <TabsTrigger value="claims">
                    Claims ({report.claims?.length ?? 0})
                  </TabsTrigger>
                </TabsList>

                {/* ---- Citations tab ---- */}
                <TabsContent value="citations">
                  {sortedCitations.length > 0 ? (
                    <div className="flex flex-col gap-3 pt-2">
                      {sortedCitations.map((citation) => {
                        const verification = report.verifications?.find(
                          (v) => v.citation_id === citation.id
                        )
                        const quoteVerification =
                          report.quoteVerifications?.find(
                            (q) => q.citation_id === citation.id
                          )

                        const cardData: Record<string, unknown> = {
                          citation,
                        }
                        if (verification)
                          cardData.verification = verification
                        if (quoteVerification)
                          cardData.quoteVerification = quoteVerification

                        return (
                          <CitationCard
                            key={citation.id}
                            citation={citation}
                            verification={verification}
                            quoteVerification={quoteVerification}
                            onViewJson={() =>
                              openJson(
                                `${citation.id} — ${citation.case_name}`,
                                citation.reporter_citation,
                                cardData
                              )
                            }
                          />
                        )
                      })}
                    </div>
                  ) : (
                    <p className="py-8 text-center text-xs text-muted-foreground">
                      No citations extracted.
                    </p>
                  )}
                </TabsContent>

                {/* ---- Quotes tab ---- */}
                <TabsContent value="quotes">
                  {(report.quoteVerifications?.length ?? 0) > 0 ? (
                    <div className="flex flex-col gap-3 pt-2">
                      {report.quoteVerifications!.map((qv) => {
                        const citation = report.citations?.find(
                          (c) => c.id === qv.citation_id
                        )
                        return (
                          <QuoteCard
                            key={qv.citation_id}
                            quoteVerification={qv}
                            citation={citation}
                            onViewJson={() =>
                              openJson(
                                `${qv.citation_id} — Quote Verification`,
                                qv.quote.slice(0, 80),
                                { quoteVerification: qv, citation }
                              )
                            }
                          />
                        )
                      })}
                    </div>
                  ) : (
                    <p className="py-8 text-center text-xs text-muted-foreground">
                      No direct quotes to verify.
                    </p>
                  )}
                </TabsContent>

                {/* ---- Claims tab ---- */}
                <TabsContent value="claims">
                  {(report.claims?.length ?? 0) > 0 ? (
                    <div className="flex flex-col gap-2 pt-2">
                      {report.claims!.map((claim) => (
                        <ClaimCard
                          key={claim.id}
                          claim={claim}
                          onViewJson={() =>
                            openJson(
                              `${claim.id} — ${claim.category}`,
                              claim.claim.slice(0, 80),
                              claim
                            )
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="py-8 text-center text-xs text-muted-foreground">
                      No claims extracted.
                    </p>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </main>

      {/* ---- Footer ---- */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-4xl px-4 py-3 text-[10px] text-muted-foreground/50 flex items-center justify-between">
          <span>BS Detector — Technical Assessment</span>
          <span>
            Press{" "}
            <kbd className="rounded-none border border-border px-1 py-0.5 text-[9px]">
              d
            </kbd>{" "}
            for dark mode
          </span>
        </div>
      </footer>

      {/* JSON Viewer */}
      <JsonViewerDialog
        open={jsonDialog.open}
        onOpenChange={(open) => setJsonDialog((prev) => ({ ...prev, open }))}
        title={jsonDialog.title}
        description={jsonDialog.description}
        data={jsonDialog.data}
      />
    </div>
  )
}
