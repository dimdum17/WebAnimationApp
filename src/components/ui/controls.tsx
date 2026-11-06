import { type ReactNode, useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
  label,
  wrap,
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange(v: T): void;
  size?: 'sm' | 'md';
  label?: string;
  wrap?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`flex ${wrap ? 'flex-wrap' : ''} gap-0.5 rounded-lg bg-panel-2 p-0.5`}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={`flex-1 whitespace-nowrap rounded-md px-2 ${size === 'sm' ? 'h-6 text-[11px]' : 'h-7 text-xs'} transition-colors ${
              on
                ? 'bg-panel-3 font-medium text-fg shadow-[inset_0_0_0_1px_var(--line-strong)]'
                : 'text-muted hover:text-fg'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange(v: T): void;
  label?: string;
}) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-8 w-full appearance-none rounded-lg border border-line bg-panel-2 pl-2.5 pr-8 text-xs text-fg outline-none hover:border-line-strong focus-visible:border-accent"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
    </div>
  );
}

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

function normHex(v: string) {
  let h = v.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return `#${h.toLowerCase()}`;
}

export function ColorInput({
  value,
  onChange,
  label,
  disabled,
}: {
  value: string;
  onChange(v: string): void;
  label?: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState(value.toUpperCase());
  useEffect(() => setText(value.toUpperCase()), [value]);
  const commit = () => {
    if (HEX.test(text)) onChange(normHex(text));
    else setText(value.toUpperCase());
  };
  return (
    <div className={`flex items-center gap-1.5 ${disabled ? 'pointer-events-none opacity-40' : ''}`}>
      <input
        aria-label={label ? `${label} hex` : 'Hex colour'}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className="h-8 w-[86px] rounded-lg border border-line bg-panel-2 px-2 font-mono text-[11px] text-fg outline-none focus-visible:border-accent"
      />
      <label className="relative h-8 w-9 cursor-pointer overflow-hidden rounded-lg border border-line-strong" style={{ background: value }}>
        <input
          type="color"
          aria-label={label ?? 'Colour'}
          value={value.length === 7 ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}

export function Field({ label, children, right }: { label: ReactNode; children?: ReactNode; right?: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{label}</span>
        {right}
      </div>
      {children}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  className = '',
  disabled,
  title,
  type = 'button',
}: {
  children: ReactNode;
  onClick?(): void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  className?: string;
  disabled?: boolean;
  title?: string;
  type?: 'button' | 'submit';
}) {
  const styles = {
    primary: 'bg-accent text-accent-fg hover:brightness-110 shadow-[0_0_0_1px_rgb(255_255_255/0.08)_inset]',
    secondary: 'bg-panel-2 text-fg border border-line hover:border-line-strong hover:bg-panel-3',
    ghost: 'text-muted hover:text-fg hover:bg-panel-2',
    danger: 'bg-red-600 text-white hover:bg-red-500',
  }[variant];
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition disabled:pointer-events-none disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function IconButton({
  children,
  onClick,
  label,
  disabled,
  className = '',
  active,
}: {
  children: ReactNode;
  onClick?(): void;
  label: string;
  disabled?: boolean;
  className?: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition disabled:pointer-events-none disabled:opacity-30 ${
        active ? 'bg-panel-3 text-fg' : 'text-muted hover:bg-panel-2 hover:text-fg'
      } ${className}`}
    >
      {children}
    </button>
  );
}
