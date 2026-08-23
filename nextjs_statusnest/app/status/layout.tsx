import Link from 'next/link';
import Image from 'next/image';

/** Shared chrome for the public status pages. */
export default function StatusLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2 text-gray-900">
            <Image src="/status_nest_logo.jpeg" alt="" width={32} height={32} className="rounded-md" />
            <span className="text-lg font-bold">StatusNest</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/status" className="text-gray-700 hover:text-gray-900">
              All status pages
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700"
            >
              Monitor your own site
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
