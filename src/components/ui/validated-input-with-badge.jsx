import * as React from "react"
import { cn } from "@/lib/utils"
import { ValidatedInput } from "./validated-input"
import { Badge } from "./badge"

const ValidatedInputWithBadge = React.forwardRef(({ 
  className, 
  showBadge = false,
  badgeText = "Unsaved",
  error,
  containerClassName,
  ...props 
}, ref) => {
  return (
    <div className={cn("relative w-full", containerClassName)}>
      <ValidatedInput 
        ref={ref}
        className={cn(
          showBadge && "pr-20",
          className
        )}
        error={error}
        {...props}
      />
      {showBadge && (
        <Badge 
          className="absolute right-2 top-2.5 pointer-events-none"
          variant="default"
          size="sm"
        >
          {badgeText}
        </Badge>
      )}
    </div>
  );
})

ValidatedInputWithBadge.displayName = "ValidatedInputWithBadge"

export { ValidatedInputWithBadge }