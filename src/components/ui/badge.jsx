import * as React from "react"
import { cn } from "../../lib/utils"

const badgeVariants = {
  default: "bg-primary text-primary-foreground shadow hover:bg-primary/80",
  success: "bg-chart-2 text-white hover:bg-chart-2/80",
  error: "bg-destructive text-destructive-foreground hover:bg-destructive/80",
  warning: "bg-chart-5 text-white hover:bg-chart-5/80",
  info: "bg-chart-1 text-white hover:bg-chart-1/80",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80", 
  muted: "bg-muted text-muted-foreground hover:bg-muted/80",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/80",
  ghost: "bg-accent/20 text-accent-foreground hover:bg-accent/30",
  outline: "border-2 border-accent text-accent hover:bg-accent hover:text-accent-foreground",
  glow: "bg-glow text-glow-foreground shadow-glow hover:shadow-glow-intense",
  ring: "ring-2 ring-accent ring-offset-2 ring-offset-background",
  gradient: "bg-gradient-to-r from-primary to-purple-600 text-white shadow-lg hover:shadow-xl transition-all",
  raised: "bg-primary text-primary-foreground shadow-md hover:shadow-lg transition-shadow"
}

const badgeSizes = {
  xs: "text-[10px] px-1.5 py-0.5 leading-none",
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-2.5 py-0.5",
  lg: "text-sm px-3 py-1",
  xl: "text-base px-4 py-1.5"
}

const badgeShapes = {
  default: "rounded-md",
  pill: "rounded-full",
  square: "rounded-sm",
  rounded: "rounded-lg"
}

const Badge = React.forwardRef(({ 
  className, 
  variant = "default", 
  size = "md",
  shape = "default",
  children,
  ...props 
}, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "inline-flex items-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        badgeVariants[variant],
        badgeSizes[size],
        badgeShapes[shape],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
})
Badge.displayName = "Badge"

// Extended badge with icon support
const BadgeWithIcon = React.forwardRef(({ 
  className, 
  variant = "default", 
  size = "md",
  shape = "default",
  icon,
  iconPosition = "left",
  children,
  ...props 
}, ref) => {
  return (
    <Badge
      ref={ref}
      variant={variant}
      size={size}
      shape={shape}
      className={cn("gap-1", className)}
      {...props}
    >
      {icon && iconPosition === "left" && (
        <span className="inline-flex shrink-0">{icon}</span>
      )}
      {children}
      {icon && iconPosition === "right" && (
        <span className="inline-flex shrink-0">{icon}</span>
      )}
    </Badge>
  )
})
BadgeWithIcon.displayName = "BadgeWithIcon"

// Animated badge with pulse effect
const AnimatedBadge = React.forwardRef(({ 
  className, 
  variant = "default", 
  size = "md",
  shape = "default",
  animate = true,
  animationType = "pulse",
  children,
  ...props 
}, ref) => {
  const animationClasses = {
    pulse: "animate-pulse",
    bounce: "animate-bounce",
    ping: "animate-ping",
    spin: "animate-spin"
  }
  
  return (
    <Badge
      ref={ref}
      variant={variant}
      size={size}
      shape={shape}
      className={cn(
        animate && animationClasses[animationType],
        className
      )}
      {...props}
    >
      {children}
    </Badge>
  )
})
AnimatedBadge.displayName = "AnimatedBadge"

// Badge with dot indicator
const DotBadge = React.forwardRef(({ 
  className, 
  variant = "default", 
  size = "md",
  shape = "default",
  dotColor = "bg-chart-2",
  dotPosition = "right",
  withAnimation = false,
  children,
  ...props 
}, ref) => {
  const dotSize = {
    sm: "w-1.5 h-1.5",
    md: "w-2 h-2",
    lg: "w-2.5 h-2.5",
    xl: "w-3 h-3"
  }

  const Dot = (
    <span 
      className={cn(
        "inline-block rounded-full",
        dotSize[size],
        dotColor,
        withAnimation && "animate-pulse"
      )} 
    />
  )
  
  return (
    <Badge
      ref={ref}
      variant={variant}
      size={size}
      shape={shape}
      className={cn("gap-1.5", className)}
      {...props}
    >
      {dotPosition === "left" && Dot}
      {children}
      {dotPosition === "right" && Dot}
    </Badge>
  )
})
DotBadge.displayName = "DotBadge"

// Badge with count
const CountBadge = React.forwardRef(({ 
  className, 
  variant = "default", 
  size = "md",
  shape = "pill",
  count,
  maxCount = 99,
  showZero = false,
  ...props 
}, ref) => {
  const displayCount = count > maxCount ? `${maxCount}+` : count
  const shouldShow = showZero || count > 0
  
  if (!shouldShow) return null
  
  return (
    <Badge
      ref={ref}
      variant={variant}
      size={size}
      shape={shape}
      className={cn("min-w-[1.5rem] justify-center", className)}
      {...props}
    >
      {displayCount}
    </Badge>
  )
})
CountBadge.displayName = "CountBadge"

// Browser Extension Badge Helper
const ExtensionBadge = React.forwardRef(({ 
  className, 
  variant = "default", 
  size = "md",
  shape = "default",
  text,
  backgroundColor,
  textColor,
  fullText,
  ...props 
}, ref) => {
  // Badge text is usually limited to 4 characters in browser extensions
  const badgeText = text ? text.substring(0, 4) : ""
  
  return (
    <div className="relative inline-block" title={fullText || text}>
      <Badge
        ref={ref}
        variant={variant}
        size={size}
        shape={shape}
        className={cn(
          "min-w-[1.5rem] justify-center font-bold uppercase",
          className
        )}
        style={{
          backgroundColor: backgroundColor,
          color: textColor
        }}
        {...props}
      >
        {badgeText}
      </Badge>
    </div>
  )
})
ExtensionBadge.displayName = "ExtensionBadge"

export { 
  Badge, 
  BadgeWithIcon, 
  AnimatedBadge, 
  DotBadge, 
  CountBadge,
  ExtensionBadge,
  badgeVariants,
  badgeSizes,
  badgeShapes
}