import type { ComponentType, ReactNode } from 'react';
import { memo, Suspense } from 'react';

export interface SuspensifyProps {
  fallback?: ReactNode;
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
