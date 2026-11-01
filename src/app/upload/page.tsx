'use client';

import { useRouter } from 'next/navigation';
import UploadModal from '@/components/upload/UploadModal';

export default function UploadPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col font-sans relative selection:bg-white/20 selection:text-white bg-[#0c1017]">

      <UploadModal
        isOpen={true}
        onClose={() => router.push('/')}
        onSuccess={() => router.push('/')}
      />
    </div>
  );
}
