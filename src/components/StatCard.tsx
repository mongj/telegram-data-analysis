import type { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: { value: number; label: string };
  className?: string;
}

export default function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  className = '',
}: StatCardProps) {
  return (
    <div
      className={`bg-dark-900 border border-dark-700 rounded-xl p-6 ${className}`}
    >
      <div className="flex items-start justify-between mb-4">
        <span className="text-dark-400 text-sm font-medium">{title}</span>
        {icon && <div className="text-dark-500">{icon}</div>}
      </div>
      <div className="space-y-1">
        <p className="text-3xl font-display font-bold text-dark-100">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        {subtitle && <p className="text-dark-500 text-sm">{subtitle}</p>}
        {trend && (
          <p
            className={`text-sm ${
              trend.value >= 0 ? 'text-accent-green' : 'text-accent-pink'
            }`}
          >
            {trend.value >= 0 ? '+' : ''}
            {trend.value}% {trend.label}
          </p>
        )}
      </div>
    </div>
  );
}

