import * as React from "react"
import { cn } from "@/lib/utils"
import { Input } from "./input"

const ValidatedInput = React.forwardRef(({ 
  className, 
  error, 
  ...props 
}, ref) => {
  return (
    <div className="w-full">
      <Input 
        ref={ref}
        className={cn(
          error && "border-destructive focus-visible:ring-destructive",
          className
        )}
        {...props}
      />
      {error && (
        <p className="text-destructive text-sm mt-1">{error}</p>
      )}
    </div>
  );
})

ValidatedInput.displayName = "ValidatedInput"

export { ValidatedInput }