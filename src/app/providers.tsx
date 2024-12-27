'use client';
import dynamic from 'next/dynamic';

const PouchDbProvider = dynamic(() => import('../app/components/pouchDbProvider'), { ssr: false });

export function Providers({ children }: Readonly<{
    children: React.ReactNode;
  }> ) {
  return (
    <PouchDbProvider>
      {children}
    </PouchDbProvider>
  );
}