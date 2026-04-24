import { logger } from "./logger"

type RetryOptions = {
  tag: string
  maxRetries?: number
  baseDelayMs?: number
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const { tag, maxRetries = 2, baseDelayMs = 1000 } = options

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      if (attempt === maxRetries) throw error

      const delayMs = baseDelayMs * Math.pow(2, attempt)
      const message = error instanceof Error ? error.message : String(error)
      logger.warn(
        tag,
        `attempt ${attempt + 1} failed: ${message}. Retrying in ${delayMs}ms...`
      )
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  throw new Error("unreachable")
}
