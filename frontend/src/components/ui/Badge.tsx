import * as React from "react"
import { cn } from "../../lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        {
          "border-transparent bg-primary text-white shadow hover:bg-blue-600": variant === "default",
          "border-transparent bg-surface text-text hover:bg-surface/80": variant === "secondary",
          "border-transparent bg-red-500 text-white shadow hover:bg-red-600": variant === "destructive",
          "border-transparent bg-green-500 text-white shadow hover:bg-green-600": variant === "success",
          "border-transparent bg-yellow-500 text-white shadow hover:bg-yellow-600": variant === "warning",
          "text-text border-border": variant === "outline",
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }
