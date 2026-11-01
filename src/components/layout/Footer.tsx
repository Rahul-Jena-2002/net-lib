'use client';

import React from 'react';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full border-t border-white/[0.08] bg-[#090d14] text-neutral-400 text-xs py-8 px-4 sm:px-6 md:px-8 mt-auto z-10">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded bg-neutral-800 border border-neutral-700/60 flex items-center justify-center text-sky-400">
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-neutral-200 tracking-tight text-sm">NetLib</span>
            <span className="text-[11px] text-neutral-400">Digital Library and PDF Reader</span>
          </div>
        </div>

        {/* Links */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-neutral-400">
          <Link href="/" className="hover:text-white transition-colors">
            Catalog
          </Link>
          <Link href="/terms" className="hover:text-white transition-colors">
            Terms of Service
          </Link>
          <Link href="/privacy" className="hover:text-white transition-colors">
            Privacy Policy
          </Link>
        </div>

        {/* Copyright & local status */}
        <div className="text-[11px] text-neutral-400 text-center md:text-right">
          <p>© {currentYear} NetLib. Local and offline-capable library reader.</p>
        </div>
      </div>
    </footer>
  );
}
