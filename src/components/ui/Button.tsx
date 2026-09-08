import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Every size meets the 44px minimum touch target (§63) — `sm` reaches it
 * through padding even though its text is smaller.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold ' +
    'transition-[transform,background-color,opacity] duration-150 ' +
    'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 ' +
    'select-none whitespace-nowrap',
  {
    variants: {
      variant: {
        primary: 'bg-[var(--shendur)] text-[#1a0e04] hover:bg-[#f07024]',
        secondary:
          'bg-[var(--dhoop-2)] text-[var(--chandan)] border border-[var(--line-strong)] hover:bg-[#302820]',
        ghost: 'text-[var(--chandan)] hover:bg-[var(--dhoop-2)]',
        brass: 'bg-[var(--pital)] text-[#1a1405] hover:bg-[#d8b02c]',
        danger: 'bg-[var(--kumkum)] text-white hover:bg-[#c62f26]',
      },
      size: {
        sm: 'h-11 px-4 text-[13px]',
        md: 'h-12 px-5 text-[15px]',
        lg: 'h-14 px-7 text-[16px]',
        icon: 'h-11 w-11',
      },
      full: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', full: false },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  className, variant, size, full, asChild = false, ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp className={cn(buttonVariants({ variant, size, full }), className)} {...props} />
  );
}

export { buttonVariants };
