import * as React from "react"
import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-14 w-full rounded-lg border-2 border-[#D1D5DB] bg-white px-4 py-3 text-base text-[#1A2332] placeholder:text-[#9CA3AF]",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3A5C]/25 focus-visible:border-[#1B3A5C]",
          "disabled:cursor-not-allowed disabled:bg-[#F9FAFB] disabled:opacity-60",
          "transition-colors duration-200",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
