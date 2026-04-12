import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
  leftIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helper, leftIcon, className, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 flex items-center justify-center h-5 w-5">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            className={`w-full ${leftIcon ? 'pl-10' : 'px-4'} py-3 bg-white border rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 transition-colors ${
              error
                ? 'border-red-400 focus:ring-red-400 focus:border-red-400'
                : 'border-gray-200 focus:ring-indigo-500 focus:border-indigo-500'
            } ${className || ''}`}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        {helper && <p className="text-xs text-gray-500 mt-1">{helper}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
