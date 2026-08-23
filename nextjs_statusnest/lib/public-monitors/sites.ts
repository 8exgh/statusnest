/**
 * The public "top sites" monitored from a real Chromium browser and published
 * on the SEO status pages (/status/{site}/{page}).
 *
 * Selection criteria: very popular ("is X down?" is a common search) AND known
 * to serve a real browser without a bot challenge. This file is the source of
 * truth — `ensurePublicSites()` registers new entries and deactivates removed
 * ones on startup, so editing it is all that is needed to change the list.
 *
 * Slugs are part of public URLs; rename with care (old URLs would 404).
 */

export interface PublicPageConfig {
  /** URL segment, e.g. "home" → /status/github/home */
  slug: string;
  name: string;
  url: string;
}

export interface PublicSiteConfig {
  /** URL segment, e.g. "github" → /status/github */
  slug: string;
  name: string;
  /** Canonical homepage, shown as the site link. */
  url: string;
  /** One sentence used in meta descriptions and on the index. */
  description: string;
  /** First page is the primary one: its status is the site's headline status. */
  pages: PublicPageConfig[];
}

export const PUBLIC_SITES: PublicSiteConfig[] = [
  {
    slug: 'google',
    name: 'Google',
    url: 'https://www.google.com/',
    description: "The world's most-used search engine, plus Maps and Gmail.",
    pages: [
      { slug: 'home', name: 'Google Search', url: 'https://www.google.com/' },
      { slug: 'maps', name: 'Google Maps', url: 'https://www.google.com/maps' },
      { slug: 'gmail', name: 'Gmail', url: 'https://mail.google.com/' },
    ],
  },
  {
    slug: 'youtube',
    name: 'YouTube',
    url: 'https://www.youtube.com/',
    description: 'Video sharing and streaming, including YouTube Music.',
    pages: [
      { slug: 'home', name: 'YouTube', url: 'https://www.youtube.com/' },
      { slug: 'music', name: 'YouTube Music', url: 'https://music.youtube.com/' },
      { slug: 'studio', name: 'YouTube Studio', url: 'https://studio.youtube.com/' },
    ],
  },
  {
    slug: 'wikipedia',
    name: 'Wikipedia',
    url: 'https://www.wikipedia.org/',
    description: 'The free encyclopedia, in English and every other language.',
    pages: [
      { slug: 'home', name: 'Wikipedia', url: 'https://www.wikipedia.org/' },
      { slug: 'english', name: 'English Wikipedia', url: 'https://en.wikipedia.org/wiki/Main_Page' },
      { slug: 'commons', name: 'Wikimedia Commons', url: 'https://commons.wikimedia.org/' },
    ],
  },
  {
    slug: 'github',
    name: 'GitHub',
    url: 'https://github.com/',
    description: 'Code hosting and collaboration for developers, plus Gists and Docs.',
    pages: [
      { slug: 'home', name: 'GitHub', url: 'https://github.com/' },
      { slug: 'explore', name: 'GitHub Explore', url: 'https://github.com/explore' },
      { slug: 'docs', name: 'GitHub Docs', url: 'https://docs.github.com/' },
    ],
  },
  {
    slug: 'discord',
    name: 'Discord',
    url: 'https://discord.com/',
    description: 'Voice, video and text chat for communities and friends.',
    pages: [
      { slug: 'home', name: 'Discord', url: 'https://discord.com/' },
      { slug: 'download', name: 'Discord Download', url: 'https://discord.com/download' },
      { slug: 'support', name: 'Discord Support', url: 'https://support.discord.com/' },
    ],
  },
  {
    slug: 'steam',
    name: 'Steam',
    url: 'https://store.steampowered.com/',
    description: 'The Steam store, community and help pages for PC gaming.',
    pages: [
      { slug: 'store', name: 'Steam Store', url: 'https://store.steampowered.com/' },
      { slug: 'community', name: 'Steam Community', url: 'https://steamcommunity.com/' },
      { slug: 'help', name: 'Steam Support', url: 'https://help.steampowered.com/' },
    ],
  },
  {
    slug: 'netflix',
    name: 'Netflix',
    url: 'https://www.netflix.com/',
    description: 'Streaming movies and TV shows, sign-in and help center.',
    pages: [
      { slug: 'home', name: 'Netflix', url: 'https://www.netflix.com/' },
      { slug: 'login', name: 'Netflix Sign In', url: 'https://www.netflix.com/login' },
      { slug: 'help', name: 'Netflix Help Center', url: 'https://help.netflix.com/' },
    ],
  },
  {
    slug: 'spotify',
    name: 'Spotify',
    url: 'https://www.spotify.com/',
    description: 'Music and podcast streaming, the web player and support.',
    pages: [
      { slug: 'home', name: 'Spotify', url: 'https://www.spotify.com/us/' },
      { slug: 'web-player', name: 'Spotify Web Player', url: 'https://open.spotify.com/' },
      { slug: 'support', name: 'Spotify Support', url: 'https://support.spotify.com/' },
    ],
  },
  {
    slug: 'microsoft',
    name: 'Microsoft',
    url: 'https://www.microsoft.com/',
    description: 'Microsoft.com, Microsoft 365 (Office) and Microsoft Learn.',
    pages: [
      { slug: 'home', name: 'Microsoft', url: 'https://www.microsoft.com/' },
      { slug: 'office', name: 'Microsoft 365 / Office', url: 'https://www.office.com/' },
      { slug: 'learn', name: 'Microsoft Learn', url: 'https://learn.microsoft.com/' },
    ],
  },
  {
    slug: 'apple',
    name: 'Apple',
    url: 'https://www.apple.com/',
    description: 'Apple.com, iCloud and Apple Support.',
    pages: [
      { slug: 'home', name: 'Apple', url: 'https://www.apple.com/' },
      { slug: 'icloud', name: 'iCloud', url: 'https://www.icloud.com/' },
      { slug: 'support', name: 'Apple Support', url: 'https://support.apple.com/' },
    ],
  },
];

/** Deterministic aggregate ids so re-running the seed is idempotent. */
export function publicSiteId(siteSlug: string): string {
  return siteSlug;
}

export function publicPageId(siteSlug: string, pageSlug: string): string {
  return `${siteSlug}/${pageSlug}`;
}

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isValidSlug(value: string): boolean {
  return SLUG_PATTERN.test(value);
}
