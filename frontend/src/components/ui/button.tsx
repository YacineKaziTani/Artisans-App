import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl',
    'text-sm font-semibold tracking-[-0.01em]',
    'transition-[transform,box-shadow,background-color,color,border-color] duration-200 ease-out',
    'active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35',
    'aria-invalid:border-destructive aria-invalid:ring-destructive/20',
  ],
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-[var(--shadow-sm)] hover:bg-brand-600 hover:shadow-[var(--shadow-glow)]',
        gradient:
          'btn-gradient text-white shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-glow)] hover:brightness-105',
        jade: 'bg-jade-500 text-white shadow-[var(--shadow-sm)] hover:bg-jade-600',
        destructive:
          'bg-destructive text-destructive-foreground shadow-[var(--shadow-sm)] hover:brightness-110 focus-visible:ring-destructive/30',
        outline:
          'border border-border bg-card text-foreground shadow-[var(--shadow-xs)] hover:border-primary/40 hover:bg-accent hover:text-accent-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground',
        soft: 'bg-brand-100 text-brand-700 hover:bg-brand-200',
        ghost:
          'text-foreground/75 hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2 has-[>svg]:px-3.5',
        sm: 'h-9 gap-1.5 rounded-lg px-3 text-[13px] has-[>svg]:px-2.5',
        lg: 'h-12 rounded-xl px-7 text-[15px] has-[>svg]:px-5',
        xl: 'h-14 rounded-2xl px-8 text-base has-[>svg]:px-6',
        icon: 'size-10',
        'icon-sm': 'size-9 rounded-lg',
        'icon-lg': 'size-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
