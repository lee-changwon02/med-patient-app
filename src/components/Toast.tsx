import { useEffect, useRef } from 'react';

export type ToastType = 'ok' | 'err' | 'warn' | '';

interface Props {
  message: string;
  type: ToastType;
  onDone: () => void;
}

export default function Toast({ message, type, onDone }: Props) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!message) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(onDone, 2600);
    return () => clearTimeout(timer.current);
  }, [message, onDone]);

  if (!message) return null;

  const bg =
    type === 'ok' ? '#166534' :
    type === 'err' ? '#991B1B' :
    type === 'warn' ? '#92400E' : '#0F172A';

  return (
    <div style={{
      position: 'fixed',
      top: 'max(env(safe-area-inset-top), 14px)',
      left: '50%',
      transform: 'translateX(-50%)',
      background: bg,
      color: '#fff',
      padding: '10px 20px',
      borderRadius: 24,
      fontSize: 13,
      fontWeight: 600,
      zIndex: 9999,
      whiteSpace: 'nowrap',
      boxShadow: '0 4px 20px rgba(0,0,0,.28)',
      pointerEvents: 'none',
    }}>
      {message}
    </div>
  );
}
