import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-gray-300 dark:border-input placeholder:text-muted-foreground/70 dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-white dark:bg-transparent px-3 py-2 text-base shadow-sm transition-all duration-200 outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm resize-y",
        "hover:border-gray-400 dark:hover:border-input/80",
        "focus-visible:border-primary focus-visible:ring-primary/20 focus-visible:ring-[3px] focus-visible:bg-white",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
