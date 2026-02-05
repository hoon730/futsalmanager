import type { InputHTMLAttributes } from "react";

interface ICheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const Checkbox = ({ label, id, className = "", ...props }: ICheckboxProps) => {
  return (
    <div className={`flex items-center gap-3 rounded-lg bg-card p-3 transition-colors hover:bg-card/80 ${className}`}>
      <input
        type="checkbox"
        id={id}
        className="h-5 w-5 cursor-pointer rounded border-gray-600 bg-background text-neon accent-neon focus:ring-2 focus:ring-neon focus:ring-offset-0"
        {...props}
      />
      <label
        htmlFor={id}
        className="flex-1 cursor-pointer select-none text-base text-white"
      >
        {label}
      </label>
    </div>
  );
};
