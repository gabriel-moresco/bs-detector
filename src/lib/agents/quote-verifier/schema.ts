import { z } from "zod"

export const llmQuoteAnalysisSchema = z.object({
  analysis: z.object({
    verdict: z
      .enum(["ACCURATE", "ALTERED", "NOT_FOUND"])
      .describe(
        "ACCURATE: the quote appears verbatim (or with only trivial formatting differences) in the opinion. " +
          "ALTERED: the quote exists in the opinion but with meaningful omissions, substitutions, or additions. " +
          "NOT_FOUND: no passage in the opinion closely matches the quoted text."
      ),
    original_text: z
      .string()
      .nullable()
      .describe(
        "The passage from the opinion that most closely matches the brief's quote, copied verbatim. " +
          "Null only when no remotely similar passage exists (NOT_FOUND with no close match)."
      ),
    alterations: z
      .array(
        z.object({
          type: z
            .enum(["omission", "substitution", "addition"])
            .describe(
              "omission: words present in the original were removed. " +
                "substitution: words were replaced with different words. " +
                "addition: words not in the original were inserted."
            ),
          brief_version: z
            .string()
            .describe("The text as it appears in the brief's quote."),
          original_version: z
            .string()
            .describe(
              "The corresponding text as it appears in the actual opinion."
            ),
          changes_meaning: z
            .boolean()
            .describe(
              "True if this alteration materially changes the legal meaning or implication of the quoted passage. " +
                "Minor formatting, punctuation, or capitalization differences are false."
            ),
        })
      )
      .describe(
        "List of specific differences between the brief's quote and the original text. " +
          "Empty array when verdict is ACCURATE or NOT_FOUND."
      ),
    reasoning: z
      .string()
      .describe(
        "Brief explanation (2-3 sentences). For ALTERED, explain what changed and whether it affects the legal meaning."
      ),
  }),
})
