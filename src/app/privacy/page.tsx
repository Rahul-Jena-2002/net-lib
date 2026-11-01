import React from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Lock } from 'lucide-react';
import Footer from '@/components/layout/Footer';

export const metadata = {
  title: 'Privacy Policy | NetLib',
  description: 'Privacy Policy for NetLib digital library platform',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0c1017] text-neutral-200">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#0c1017]/95 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 text-xs font-medium text-neutral-300 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Library</span>
        </Link>
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-sky-400" />
          <span className="font-bold text-sm tracking-tight text-white">NetLib</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center text-sky-400">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Privacy Policy</h1>
            <p className="text-xs text-neutral-400">Last updated: November 2026</p>
          </div>
        </div>

        <div className="space-y-8 text-xs sm:text-sm text-neutral-300 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">1. Offline and Local-First Architecture</h2>
            <p>
              NetLib is engineered with privacy at its core. It operates locally or against your designated private library
              storage server. We do not use third-party analytics trackers, session replay scripts, or external advertising beacons.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">2. Information Stored Locally</h2>
            <p>
              The application persists minimal reading session state exclusively within your web browser&apos;s localStorage:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-neutral-400">
              <li>
                <strong className="text-neutral-200">Reading Progress:</strong> Current chapter, page number, and completed
                chapters per book to allow seamless reading resumption.
              </li>
              <li>
                <strong className="text-neutral-200">Reader Preferences:</strong> Chosen font size (sm, md, lg, xl),
                theme mode (Dark, Sepia, Light), and reader layout width.
              </li>
              <li>
                <strong className="text-neutral-200">Catalog Cache:</strong> In-memory and local cache to provide instant catalog discovery.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">3. Network Isolation and PDF Rendering</h2>
            <p>
              The PDF rendering worker (<code className="text-neutral-300 bg-neutral-800 px-1 py-0.5 rounded">pdf.worker.min.mjs</code>)
              is packaged locally with the NetLib distribution. No document data is sent to external cloud APIs for parsing or rendering.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">4. Uploaded Content</h2>
            <p>
              Files uploaded through the Add Book interface are written directly to your designated server storage directory.
              NetLib does not transmit your files to external services.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">5. Your Control and Data Deletion</h2>
            <p>
              You maintain complete ownership and control over your data. Clearing your browser&apos;s site data or local storage
              will immediately remove all saved reading progress and reader preferences from your device.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
