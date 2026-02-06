import * as React from "react"
import { cn } from "@/lib/utils"

interface TabsContextType {
  value: string
  setValue: (value: string) => void
}

const TabsContext = React.createContext<TabsContextType>({ value: "", setValue: () => {} })

function Tabs({ children, defaultValue, value: controlledValue, onValueChange, className }: {
  children: React.ReactNode
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  className?: string
}) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue || "")
  const value = controlledValue !== undefined ? controlledValue : uncontrolledValue
  const setValue = onValueChange || setUncontrolledValue
  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground", className)}>
      {children}
    </div>
  )
}

function TabsTrigger({ children, value, className }: { children: React.ReactNode; value: string; className?: string }) {
  const { value: selectedValue, setValue } = React.useContext(TabsContext)
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        selectedValue === value && "bg-background text-foreground shadow-sm",
        className
      )}
      onClick={() => setValue(value)}
    >
      {children}
    </button>
  )
}

function TabsContent({ children, value, className }: { children: React.ReactNode; value: string; className?: string }) {
  const { value: selectedValue } = React.useContext(TabsContext)
  if (selectedValue !== value) return null
  return <div className={cn("mt-2", className)}>{children}</div>
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
