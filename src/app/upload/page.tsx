'use client';

import { useRouter } from 'next/navigation';
import UploadModal from '@/components/upload/UploadModal';

export default function UploadPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col font-sans relative selection:bg-white/20 selection:text-white bg-[var(--canvas-bg)]">
      {/* Ambient Optical Background Lighting */}
      <div className="ambient-optical-canvas">
        <div className="ambient-light-orb-1" />
        <div className="ambient-light-orb-2" />
      </div>

      <UploadModal
        isOpen={true}
        onClose={() => router.push('/')}
        onSuccess={() => router.push('/')}
      />
    </div>
  );
}
