import React from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, ShieldCheck } from 'lucide-react';
import Footer from '@/components/layout/Footer';

export const metadata = {
  title: 'Terms of Service | NetLib',
  description: 'Terms of Service for using NetLib digital library platform',
};

export default function TermsPage() {
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
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Terms of Service</h1>
            <p className="text-xs text-neutral-400">Last updated: November 2026</p>
          </div>
        </div>

        <div className="space-y-8 text-xs sm:text-sm text-neutral-300 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">1. Purpose and Scope</h2>
            <p>
              NetLib is a digital library platform and offline-first reader application designed to facilitate reading,
              navigating, and cataloging educational publications, technical books, and PDF documents. By accessing or
              using the platform, you agree to these Terms of Service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">2. Local Storage and Client-Side State</h2>
            <p>
              NetLib stores reading progress, bookmarks, font size settings, and reader theme preferences locally on your
              device through browser localStorage. NetLib does not sell, transmit, or monetize your local reading history.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">3. Content and Intellectual Property</h2>
            <p>
              All titles, covers, book text, and illustrations made accessible through NetLib belong to their respective
              authors, copyright holders, and publishers. Users are responsible for ensuring that uploaded or indexed
              materials comply with relevant copyright and licensing agreements.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">4. Uploads and Document Integrity</h2>
            <p>
              When uploading PDF publications to your local library instance, you represent that you possess the right to
              store and view the document. NetLib enforces strict file format validation and path verification to ensure
              safe streaming.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">5. Disclaimer of Warranties</h2>
            <p>
              NetLib is provided on an &quot;as is&quot; and &quot;as available&quot; basis without warranties of any kind, whether express
              or implied. While we strive for optimal PDF rendering and accurate chapter sequencing, we do not guarantee
              uninterrupted or error-free operation.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">6. Updates to Terms</h2>
            <p>
              We reserve the right to revise these Terms of Service as application features evolve. Continued use of
              NetLib following any changes constitutes acceptance of the updated terms.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
