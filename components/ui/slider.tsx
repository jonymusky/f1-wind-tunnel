"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

function Slider({ className, "aria-label": ariaLabel, ...props }: React.ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      className={cn("relative flex h-5 w-full touch-none select-none items-center", className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-[3px] w-full grow overflow-hidden rounded-full bg-line-strong">
        <SliderPrimitive.Range className="absolute h-full bg-ink-2" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb aria-label={ariaLabel} className="block size-3.5 cursor-grab rounded-full border border-white/20 bg-ink shadow-[0_1px_4px_rgba(0,0,0,0.6)] transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:cursor-grabbing" />
    </SliderPrimitive.Root>
  )
}

export { Slider }
