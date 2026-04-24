function fmt(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`
}

export const logger = {
  stageStart(name: string): void {
    console.log(`\n[${name}] started`)
  },

  stageEnd(name: string, elapsedMs: number, summary: string): void {
    console.log(`[${name}] done in ${fmt(elapsedMs)} — ${summary}`)
  },

  step(name: string, msg: string): void {
    console.log(`[${name}] ${msg}`)
  },

  warn(name: string, msg: string): void {
    console.warn(`[${name}] WARN: ${msg}`)
  },

  pipelineDone(elapsedMs: number): void {
    console.log(`\n[pipeline] done in ${fmt(elapsedMs)}`)
  },
}
