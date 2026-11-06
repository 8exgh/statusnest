import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/api/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }];
  },
  // Next streams <title>/<meta> into the body for dynamic pages (React hoists
  // them into <head> on hydration). Crawlers and link-preview bots that do not
  // run JavaScript get the metadata rendered in <head> instead.
  htmlLimitedBots:
    /Googlebot|Google-InspectionTool|bingbot|BingPreview|DuckDuckBot|Slurp|Baiduspider|YandexBot|Applebot|facebookexternalhit|Twitterbot|LinkedInBot|Discordbot|WhatsApp|TelegramBot|Slackbot|Pinterestbot|redditbot|ia_archiver|SemrushBot|AhrefsBot/i,
};

export default nextConfig;
