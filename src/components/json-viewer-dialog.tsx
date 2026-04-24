"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  CodeBlock,
  CodeBlockHeader,
  CodeBlockActions,
  CodeBlockCopyButton,
} from "@/components/ai-elements/code-block"

export function JsonViewerDialog({
  open,
  onOpenChange,
  title,
  description,
  data,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  data: unknown
}) {
  const json = JSON.stringify(data, null, 2)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-2xl md:max-w-4xl">
        <DialogHeader className="shrink-0 border-b border-border px-5 pt-5 pb-3">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-hidden p-4">
          <CodeBlock
            code={json}
            language="json"
            className="max-h-[calc(85vh-10rem)] [&_pre]:break-all [&_pre]:whitespace-pre-wrap [&>div]:max-h-[calc(85vh-13rem)] [&>div]:overflow-auto"
          >
            <CodeBlockHeader>
              <CodeBlockActions className="ml-auto">
                <CodeBlockCopyButton />
              </CodeBlockActions>
            </CodeBlockHeader>
          </CodeBlock>
        </div>
      </DialogContent>
    </Dialog>
  )
}
