import * as React from "react"
import { cn } from "@/lib/utils"
import { Input } from "./input"
import { Badge } from "./badge"

const InputWithBadge = React.forwardRef(({ 
  className, 
  showBadge = false,
  badgeText = "Unsaved",
  inputClassName,
  containerClassName,
  ...props 
}, ref) => {
  return (
    <div className={cn("relative w-full", containerClassName)}>
      <Input 
        ref={ref}
        className={cn(
          showBadge && "pr-20",
          inputClassName || className
        )}
        {...props}
      />
      {showBadge && (
        <Badge 
          className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
          variant="default"
          size="sm"
        >
          {badgeText}
        </Badge>
      )}
    </div>
  );
})

InputWithBadge.displayName = "InputWithBadge"

export { InputWithBadge }