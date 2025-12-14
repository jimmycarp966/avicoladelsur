import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "relative overflow-hidden rounded-md bg-muted",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent",
        className
      )}
      {...props}
    />
  )
}

function SkeletonCircle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <Skeleton
      className={cn("rounded-full", className)}
      {...props}
    />
  )
}

function SkeletonText({ className, lines = 1, ...props }: React.ComponentProps<"div"> & { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-4",
            i === lines - 1 && lines > 1 ? "w-3/4" : "w-full",
            className
          )}
          {...props}
        />
      ))}
    </div>
  )
}

export { Skeleton, SkeletonCircle, SkeletonText }
