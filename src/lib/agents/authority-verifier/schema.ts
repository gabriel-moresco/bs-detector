import { z } from "zod"

export const llmVerdictWrapperSchema = z.object({
  analysis: z.object({
    verdict: z
      .enum(["SUPPORTS", "MISREPRESENTS"])
      .describe(
        "SUPPORTS: the cited case genuinely supports the proposition as stated in the brief. " +
          "MISREPRESENTS: the case exists but does not support the proposition — " +
          "the brief materially mischaracterizes what the case holds."
      ),
    reasoning: z
      .string()
      .describe(
        "Brief explanation (2-4 sentences). For SUPPORTS, explain how the holding aligns with the proposition. " +
          "For MISREPRESENTS, explain what the case actually holds vs. what the brief claims."
      ),
    evidence_excerpt: z
      .string()
      .describe(
        "The most relevant excerpt from the provided opinion text that supports the verdict. " +
          "Copy verbatim from the opinion — do not paraphrase or fabricate text."
      ),
  }),
})
