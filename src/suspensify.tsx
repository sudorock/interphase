import type { ComponentType, CSSProperties, ReactNode } from 'react';
import { memo, Suspense } from 'react';

export interface SuspensePlaceholderProps {
  suspenseLines?: number;
  suspenseColor?: 'grey' | 'primary';
  suspenseLineHeight?: string;
  suspenseCircle?: boolean;
}

export interface SuspensifyProps {
  fallback?: ReactNode;
}

const toCssLength = (value?: string) => {
  if (!value) {
    return undefined;
  }

  return /^\d+(\.\d+)?$/.test(value) ? `${value}px` : value;
};

const getPlaceholderColor = (kind: SuspensePlaceholderProps['suspenseColor']) => {
  return kind === 'primary' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(15, 23, 42, 0.08)';
};

export function SuspensePlaceholder({
  suspenseLines,
  suspenseLineHeight,
  suspenseColor,
  suspenseCircle,
}: SuspensePlaceholderProps) {
  const color = getPlaceholderColor(suspenseColor);
  const height = toCssLength(suspenseLineHeight) ?? '1em';
  const style: CSSProperties = {
    backgroundColor: color,
    display: 'block',
    height,
  };

  if (suspenseCircle) {
    const size = toCssLength(suspenseLineHeight) ?? '2.5rem';

    return (
      <span
        aria-hidden
        style={{
          ...style,
          borderRadius: '9999px',
          height: size,
          width: size,
        }}
      />
    );
  }

  return (
    <div
      aria-hidden
      style={{
        display: 'grid',
        gap: '0.5rem',
      }}
    >
      {Array.from({ length: suspenseLines ?? 1 }, (_, index) => (
        <span
          key={index}
          style={{
            ...style,
            borderRadius: '0.25rem',
            width: index === (suspenseLines ?? 1) - 1 ? '75%' : '100%',
          }}
        />
      ))}
    </div>
  );
}

export const suspensify = <P extends object>(Component: ComponentType<P>) =>
  memo((props: P & SuspensifyProps) => {
    const { fallback, ...componentProps } = props;

    return (
      <Suspense fallback={fallback ?? null}>
        <Component {...(componentProps as P)} />
      </Suspense>
    );
  });
