import Link from 'next/link';

export default function BotPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-4xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-5xl font-bold text-gray-800 mb-4">
            Backlink Spider 🕷️
          </h1>
          <p className="text-xl text-gray-600">
            Mapping the interconnected web, one link at a time
          </p>
        </div>

        {/* Purpose Section */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-3xl font-semibold text-gray-800 mb-6">Our Purpose</h2>
          <div className="prose prose-lg text-gray-600 space-y-4">
            <p>
              <strong>Backlink Spider</strong> is an automated web crawler designed to collect and maintain
              an updated graph of the internet's link structure. Our mission is to understand how
              websites connect to each other through hyperlinks, creating a comprehensive map of
              the web's interconnections.
            </p>
            <p>
              By analyzing backlinks and forward links across millions of pages, we help researchers,
              SEO professionals, and web analysts understand the complex relationships between
              websites and how information flows across the internet.
            </p>
          </div>
        </div>

        {/* What We Do Section */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-3xl font-semibold text-gray-800 mb-6">What We Do</h2>
          <ul className="space-y-4 text-gray-600">
            <li className="flex items-start">
              <span className="text-green-500 mr-3 text-xl">✓</span>
              <div>
                <strong>Discover Links:</strong> We crawl web pages to identify all outbound and inbound links,
                building a comprehensive database of web connections.
              </div>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-3 text-xl">✓</span>
              <div>
                <strong>Map Relationships:</strong> We analyze link patterns to understand how different
                websites and pages relate to each other in the broader web ecosystem.
              </div>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-3 text-xl">✓</span>
              <div>
                <strong>Track Changes:</strong> We continuously update our graph to reflect the dynamic
                nature of the web, tracking new links, broken links, and changing relationships.
              </div>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-3 text-xl">✓</span>
              <div>
                <strong>Respect Standards:</strong> We follow robots.txt directives and crawl responsibly
                to minimize impact on server resources.
              </div>
            </li>
          </ul>
        </div>

        {/* Technical Details */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-3xl font-semibold text-gray-800 mb-6">Technical Information</h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">User Agent</h3>
              <code className="bg-black px-3 py-1 rounded text-sm">
                Mozilla/5.0 (compatible; StatusNestBacklinkSpider/1.0; +https://statusnest.com/bot)
              </code>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">Crawl Rate</h3>
              <p className="text-gray-600">
                We maintain a respectful crawl rate of maximum 1 request per second per domain,
                with automatic backoff if server load is detected.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">Data Collection</h3>
              <p className="text-gray-600">
                We only collect publicly available link data and basic page metadata.
                We do not collect personal information, form data, or any private content.
              </p>
            </div>
          </div>
        </div>

        {/* Opt-Out Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 mb-8">
          <h2 className="text-3xl font-semibold text-gray-800 mb-6">Controlling Our Access</h2>
          <div className="space-y-4 text-gray-600">
            <p>
              We respect website owners' preferences. To control or block Backlink Spider:
            </p>
            <div className="bg-white p-4 rounded border border-blue-200">
              <h3 className="font-semibold mb-2">Via robots.txt:</h3>
              <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
{`User-agent: StatusNestBacklinkSpider
Disallow: /`}
              </pre>
            </div>
            <p>
              You can also specify specific paths or set crawl delays. We check robots.txt
              before every crawl session and immediately respect any changes.
            </p>
          </div>
        </div>


        {/* Footer */}
        <div className="mt-12 text-center text-gray-500">
          <p className="mb-4">
            Backlink Spider is part of the StatusNest monitoring infrastructure
          </p>
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Return to StatusNest
          </Link>
        </div>
      </div>
    </div>
  );
}