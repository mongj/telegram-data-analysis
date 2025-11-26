import type { TimeGranularity } from '../types';

interface TimeGranularityToggleProps {
  value: TimeGranularity;
  onChange: (value: TimeGranularity) => void;
}

const options: { value: TimeGranularity; label: string }[] = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Yearly' },
];

export default function TimeGranularityToggle({
  value,
  onChange,
}: TimeGranularityToggleProps) {
  return (
    <div className="inline-flex bg-dark-800 border border-dark-600 rounded-lg p-1">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
            value === option.value
              ? 'bg-dark-600 text-dark-100'
              : 'text-dark-400 hover:text-dark-200'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

