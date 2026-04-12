import React from 'react';
import { Spinner } from './Spinner';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'full';
  isLoading?: boolean;
  children: React.ReactNode;
  as?: React.ElementType;
}

const variantClasses = {
  primary:
    'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50',
  secondary:
    'bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50 disabled:opacity-50',
  ghost: 'text-indigo-600 hover:bg-indigo-50 disabled:opacity-50',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 disabled:opacity-50',
};

const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm rounded-md',
  md: 'px-4 py-2.5 text-sm rounded-lg',
  lg: 'px-6 py-3 text-base rounded-xl',
  full: 'w-full px-4 py-3 text-base rounded-xl',
};

export const Button = React.forwardRef<
  HTMLButtonElement,
  ButtonProps & { href?: string }
>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      children,
      disabled,
      className,
      as: Component,
      ...props
    },
    ref
  ) => {
    const Comp = Component || 'button';
    const buttonClasses = `font-medium transition-colors inline-flex items-center justify-center gap-2 ${variantClasses[variant]} ${sizeClasses[size]} ${isLoading ? 'cursor-wait' : ''} ${className || ''}`;

    if (Component) {
      return (
        <Comp
          ref={ref}
          disabled={disabled || isLoading}
          className={buttonClasses}
          {...props}
        >
          {isLoading && <Spinner size="sm" />}
          {children}
        </Comp>
      );
    }

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={buttonClasses}
        {...props}
      >
        {isLoading && <Spinner size="sm" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
