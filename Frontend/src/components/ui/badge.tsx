import React from 'react'

const Badge = ({ children, variant = "default", className = "" }: { children: React.ReactNode, variant?: "default" | "secondary" | "destructive" | "outline", className?: string }) => {
  const variants = {
    default: "bg-zinc-900 text-zinc-50 hover:bg-zinc-900/80 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-50/80",
    secondary: "bg-zinc-100 text-zinc-900 hover:bg-zinc-100/80 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-800/80",
    destructive: "bg-red-500 text-zinc-50 hover:bg-red-500/80 dark:bg-red-900 dark:text-zinc-50 dark:hover:bg-red-900/80",
    outline: "text-zinc-950 dark:text-zinc-50 border border-zinc-200 dark:border-zinc-800"
  }
  return <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 dark:border-zinc-800 dark:focus:ring-zinc-300 ${variants[variant]} ${className}`}>{children}</div>
}

export default Badge