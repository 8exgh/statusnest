import Link from 'next/link';

/** Site-wide footer: credits (followed links) and the main internal sections. */
export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>
          Created by{' '}
          <a href="https://8examples.com" className="font-medium text-gray-900 hover:underline">
            8examples.com
          </a>
          {' · '}
          Hosted by{' '}
          <a href="https://swiftgrid.net" className="font-medium text-gray-900 hover:underline">
            SwiftGrid.net
          </a>
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-1">
          <Link href="/status" className="hover:text-gray-900 hover:underline">
            Status pages
          </Link>
          <Link href="/dashboard" className="hover:text-gray-900 hover:underline">
            Dashboard
          </Link>
          <Link href="/bot" className="hover:text-gray-900 hover:underline">
            Backlink Spider
          </Link>
          <span className="text-gray-400">© {year} StatusNest</span>
        </nav>
      </div>
    </footer>
  );
}
