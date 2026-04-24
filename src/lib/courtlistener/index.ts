import { readFile, writeFile, mkdir } from "node:fs/promises"
import path from "node:path"
import { createHash } from "node:crypto"

const BASE_URL = "https://www.courtlistener.com"
const CACHE_DIR = path.join(process.cwd(), ".cache", "courtlistener")

export type LookupHit = {
  found: true
  opinion_text: string
  case_name: string
  courtlistener_url: string
}

export type LookupMiss = {
  found: false
  reason: "not_found" | "error"
  details?: string
}

export type LookupResult = LookupHit | LookupMiss

function cacheKey(citation: string): string {
  return createHash("sha256")
    .update(citation.toLowerCase().trim())
    .digest("hex")
}

async function readCache(key: string): Promise<LookupResult | null> {
  try {
    const raw = await readFile(path.join(CACHE_DIR, `${key}.json`), "utf-8")
    return JSON.parse(raw) as LookupResult
  } catch {
    return null
  }
}

async function writeCache(key: string, data: LookupResult): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true })
  await writeFile(
    path.join(CACHE_DIR, `${key}.json`),
    JSON.stringify(data, null, 2)
  )
}

function getToken(): string {
  const token = process.env.COURTLISTENER_API_TOKEN
  if (!token) throw new Error("COURTLISTENER_API_TOKEN is not set")
  return token
}

function normalizeCitation(cite: string): string {
  return cite.toLowerCase().replace(/[\s.]+/g, "")
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

export async function lookupCitation(
  reporterCitation: string
): Promise<LookupResult> {
  const key = cacheKey(reporterCitation)
  const cached = await readCache(key)
  if (cached) {
    console.log(`[courtlistener] cache hit: ${reporterCitation}`)
    return cached
  }

  console.log(`[courtlistener] searching: ${reporterCitation}`)
  const token = getToken()

  try {
    const searchUrl = new URL("/api/rest/v4/search/", BASE_URL)
    searchUrl.searchParams.set("type", "o")
    searchUrl.searchParams.set("q", `"${reporterCitation}"`)

    const searchRes = await fetch(searchUrl.toString(), {
      headers: { Authorization: `Token ${token}` },
    })

    if (!searchRes.ok) {
      return {
        found: false,
        reason: "error",
        details: `Search API returned ${searchRes.status}`,
      }
    }

    const searchData = await searchRes.json()

    if (!searchData.results?.length) {
      const result: LookupMiss = { found: false, reason: "not_found" }
      await writeCache(key, result)
      return result
    }

    const normalized = normalizeCitation(reporterCitation)
    const match = searchData.results.find((r: { citation?: string[] }) =>
      r.citation?.some((c: string) => normalizeCitation(c) === normalized)
    )

    if (!match) {
      const returnedCitations = searchData.results
        .slice(0, 3)
        .map(
          (r: { caseName?: string; citation?: string[] }) =>
            `${r.caseName}: [${(r.citation || []).join(", ")}]`
        )
      console.log(
        `[courtlistener] no match for "${reporterCitation}" in ${searchData.results.length} results. Top: ${returnedCitations.join(" | ")}`
      )
      const result: LookupMiss = { found: false, reason: "not_found" }
      await writeCache(key, result)
      return result
    }

    const opinionId: number | undefined = match.opinions?.[0]?.id

    if (!opinionId) {
      const result: LookupMiss = {
        found: false,
        reason: "not_found",
        details: "Matching result found but no opinion ID",
      }
      await writeCache(key, result)
      return result
    }

    const opinionUrl = new URL(`/api/rest/v4/opinions/${opinionId}/`, BASE_URL)
    opinionUrl.searchParams.set("fields", "html_with_citations,plain_text")

    const opinionRes = await fetch(opinionUrl.toString(), {
      headers: { Authorization: `Token ${token}` },
    })

    if (!opinionRes.ok) {
      return {
        found: false,
        reason: "error",
        details: `Opinions API returned ${opinionRes.status}`,
      }
    }

    const opinion = await opinionRes.json()
    const text =
      opinion.plain_text || stripHtml(opinion.html_with_citations || "")

    if (!text) {
      const result: LookupMiss = {
        found: false,
        reason: "not_found",
        details: "Opinion found but no text available",
      }
      await writeCache(key, result)
      return result
    }

    const result: LookupHit = {
      found: true,
      opinion_text: text,
      case_name: (match.caseName as string) || "",
      courtlistener_url: `${BASE_URL}${match.absolute_url || `/opinion/${match.cluster_id}/`}`,
    }

    await writeCache(key, result)
    return result
  } catch (err) {
    // Don't cache transient errors (network, timeout)
    return {
      found: false,
      reason: "error",
      details: err instanceof Error ? err.message : String(err),
    }
  }
}
