import type { ReactNode } from "react";

interface ICardProps {
  children: ReactNode;
  className?: string;
  title?: string;
}

export const Card = ({ children, className = "", title }: ICardProps) => {
  return (
    <div
      className={`rounded-2xl bg-gradient-to-br from-card to-card/90 p-6 shadow-lg ${className}`}
    >
      {title && (
        <h3 className="mb-4 text-lg font-bold text-white">{title}</h3>
      )}
      {children}
    </div>
  );
};
