import type { CheckTier } from './schedule';

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
  /** Grouping on the status index. */
  category: PublicCategorySlug;
  /**
   * Check cadence (see schedule.ts). `primary` is 5–20 min and is reserved for
   * the best-known sites; everything else is `standard` (20–60 min), which
   * keeps total crawl traffic sane across a hundred sites.
   */
  tier?: CheckTier;
  /** First page is the primary one: its status is the site's headline status. */
  pages: PublicPageConfig[];
}

/** Categories the status index groups by, in display order. */
export const PUBLIC_CATEGORIES = [
  { slug: 'search', label: 'Search & Reference', blurb: 'Search engines, encyclopedias and reference sites.' },
  { slug: 'social', label: 'Social & Messaging', blurb: 'Social networks, messaging apps and communities.' },
  { slug: 'video', label: 'Video & Streaming', blurb: 'Video platforms and streaming services.' },
  { slug: 'music', label: 'Music & Audio', blurb: 'Music streaming and audio platforms.' },
  { slug: 'gaming', label: 'Gaming', blurb: 'Game stores, platforms and online services.' },
  { slug: 'ai', label: 'AI', blurb: 'AI assistants, models and research labs.' },
  { slug: 'developer', label: 'Developer & Open Source', blurb: 'Code hosting, package registries, docs and open-source projects.' },
  { slug: 'cloud', label: 'Cloud & Business Software', blurb: 'Cloud platforms and the SaaS tools businesses run on.' },
  { slug: 'tech', label: 'Tech & Devices', blurb: 'Hardware makers and consumer technology.' },
  { slug: 'news', label: 'News & Media', blurb: 'News organisations and technology publications.' },
  { slug: 'shopping', label: 'Shopping & Marketplaces', blurb: 'Online stores and marketplaces.' },
  { slug: 'finance', label: 'Finance & Payments', blurb: 'Payment networks, fintech and exchanges.' },
  { slug: 'learning', label: 'Learning', blurb: 'Online courses, universities and educational sites.' },
] as const;

export type PublicCategorySlug = (typeof PUBLIC_CATEGORIES)[number]['slug'];

export function categoryLabel(slug: string): string {
  return PUBLIC_CATEGORIES.find(c => c.slug === slug)?.label ?? 'Other';
}

export function isPublicCategory(value: unknown): value is PublicCategorySlug {
  return typeof value === 'string' && PUBLIC_CATEGORIES.some(c => c.slug === value);
}

export const PUBLIC_SITES: PublicSiteConfig[] = [
  {
    slug: 'google',
    name: 'Google',
    url: 'https://www.google.com/',
    description: 'The world\'s most-used search engine, plus Maps and Gmail.',
    category: 'search',
    tier: 'primary',
    pages: [
      { slug: 'home', name: 'Google Search', url: 'https://www.google.com/' },
      { slug: 'maps', name: 'Google Maps', url: 'https://www.google.com/maps' },
      { slug: 'gmail', name: 'Gmail', url: 'https://mail.google.com/' },
    ],
  },
  {
    slug: 'wikipedia',
    name: 'Wikipedia',
    url: 'https://www.wikipedia.org/',
    description: 'The free encyclopedia, in English and every other language.',
    category: 'search',
    tier: 'primary',
    pages: [
      { slug: 'home', name: 'Wikipedia', url: 'https://www.wikipedia.org/' },
      { slug: 'english', name: 'English Wikipedia', url: 'https://en.wikipedia.org/wiki/Main_Page' },
      { slug: 'commons', name: 'Wikimedia Commons', url: 'https://commons.wikimedia.org/' },
    ],
  },
  {
    slug: 'archive-org',
    name: 'Archive.org',
    url: 'https://archive.org/',
    description: 'The Internet Archive and the Wayback Machine.',
    category: 'search',
    pages: [
      { slug: 'home', name: 'Internet Archive', url: 'https://archive.org/' },
      { slug: 'wayback', name: 'Wayback Machine', url: 'https://web.archive.org/' },
      { slug: 'about', name: 'About the Archive', url: 'https://archive.org/about/' },
    ],
  },
  {
    slug: 'bing',
    name: 'Bing',
    url: 'https://www.bing.com/',
    description: 'Microsoft\'s search engine, including image and map search.',
    category: 'search',
    pages: [
      { slug: 'home', name: 'Bing Search', url: 'https://www.bing.com/' },
      { slug: 'images', name: 'Bing Images', url: 'https://www.bing.com/images' },
      { slug: 'maps', name: 'Bing Maps', url: 'https://www.bing.com/maps' },
    ],
  },
  {
    slug: 'britannica',
    name: 'Britannica',
    url: 'https://www.britannica.com/',
    description: 'The online Encyclopaedia Britannica and dictionary.',
    category: 'search',
    pages: [
      { slug: 'home', name: 'Britannica', url: 'https://www.britannica.com/' },
      { slug: 'dictionary', name: 'Britannica Dictionary', url: 'https://www.britannica.com/dictionary' },
      { slug: 'science', name: 'Britannica Science', url: 'https://www.britannica.com/browse/Science' },
    ],
  },
  {
    slug: 'duckduckgo',
    name: 'DuckDuckGo',
    url: 'https://duckduckgo.com/',
    description: 'The privacy-focused search engine and its browser.',
    category: 'search',
    pages: [
      { slug: 'home', name: 'DuckDuckGo', url: 'https://duckduckgo.com/' },
      { slug: 'about', name: 'About DuckDuckGo', url: 'https://duckduckgo.com/about' },
      { slug: 'help', name: 'DuckDuckGo Help', url: 'https://duckduckgo.com/duckduckgo-help-pages/' },
    ],
  },
  {
    slug: 'imdb',
    name: 'IMDb',
    url: 'https://www.imdb.com/',
    description: 'The Internet Movie Database: films, TV and celebrities.',
    category: 'search',
    pages: [
      { slug: 'home', name: 'IMDb', url: 'https://www.imdb.com/' },
      { slug: 'top', name: 'IMDb Top 250', url: 'https://www.imdb.com/chart/top/' },
      { slug: 'news', name: 'IMDb News', url: 'https://www.imdb.com/news/' },
    ],
  },
  {
    slug: 'openstreetmap',
    name: 'OpenStreetMap',
    url: 'https://www.openstreetmap.org/',
    description: 'The free, editable map of the world.',
    category: 'search',
    pages: [
      { slug: 'home', name: 'OpenStreetMap', url: 'https://www.openstreetmap.org/' },
      { slug: 'about', name: 'About OpenStreetMap', url: 'https://www.openstreetmap.org/about' },
      { slug: 'wiki', name: 'OpenStreetMap Wiki', url: 'https://wiki.openstreetmap.org/' },
    ],
  },
  {
    slug: 'wolframalpha',
    name: 'Wolfram Alpha',
    url: 'https://www.wolframalpha.com/',
    description: 'The computational knowledge engine.',
    category: 'search',
    pages: [
      { slug: 'home', name: 'Wolfram Alpha', url: 'https://www.wolframalpha.com/' },
      { slug: 'examples', name: 'Wolfram Alpha Examples', url: 'https://www.wolframalpha.com/examples' },
      { slug: 'about', name: 'About Wolfram Alpha', url: 'https://www.wolframalpha.com/about' },
    ],
  },
  {
    slug: 'discord',
    name: 'Discord',
    url: 'https://discord.com/',
    description: 'Voice, video and text chat for communities and friends.',
    category: 'social',
    tier: 'primary',
    pages: [
      { slug: 'home', name: 'Discord', url: 'https://discord.com/' },
      { slug: 'download', name: 'Discord Download', url: 'https://discord.com/download' },
      { slug: 'support', name: 'Discord Support', url: 'https://support.discord.com/' },
    ],
  },
  {
    slug: 'facebook',
    name: 'Facebook',
    url: 'https://www.facebook.com/',
    description: 'The Facebook social network, business tools and help center.',
    category: 'social',
    pages: [
      { slug: 'home', name: 'Facebook', url: 'https://www.facebook.com/' },
      { slug: 'business', name: 'Facebook Business', url: 'https://www.facebook.com/business' },
      { slug: 'help', name: 'Facebook Help Center', url: 'https://www.facebook.com/help/' },
    ],
  },
  {
    slug: 'instagram',
    name: 'Instagram',
    url: 'https://www.instagram.com/',
    description: 'Photo and video sharing from Meta.',
    category: 'social',
    pages: [
      { slug: 'home', name: 'Instagram', url: 'https://www.instagram.com/' },
      { slug: 'about', name: 'About Instagram', url: 'https://about.instagram.com/' },
      { slug: 'help', name: 'Instagram Help', url: 'https://help.instagram.com/' },
    ],
  },
  {
    slug: 'pinterest',
    name: 'Pinterest',
    url: 'https://www.pinterest.com/',
    description: 'Visual discovery: ideas, boards and pins.',
    category: 'social',
    pages: [
      { slug: 'home', name: 'Pinterest', url: 'https://www.pinterest.com/' },
      { slug: 'ideas', name: 'Pinterest Ideas', url: 'https://www.pinterest.com/ideas/' },
      { slug: 'business', name: 'Pinterest Business', url: 'https://business.pinterest.com/' },
    ],
  },
  {
    slug: 'reddit',
    name: 'Reddit',
    url: 'https://www.reddit.com/',
    description: 'The front page of the internet: communities and discussion.',
    category: 'social',
    pages: [
      { slug: 'home', name: 'Reddit', url: 'https://www.reddit.com/' },
      { slug: 'popular', name: 'Reddit Popular', url: 'https://www.reddit.com/r/popular/' },
      { slug: 'technology', name: 'r/technology', url: 'https://www.reddit.com/r/technology/' },
    ],
  },
  {
    slug: 'snapchat',
    name: 'Snapchat',
    url: 'https://www.snapchat.com/',
    description: 'Camera-first messaging and Stories.',
    category: 'social',
    pages: [
      { slug: 'home', name: 'Snapchat', url: 'https://www.snapchat.com/' },
      { slug: 'download', name: 'Snapchat Download', url: 'https://www.snapchat.com/download' },
      { slug: 'support', name: 'Snapchat Support', url: 'https://help.snapchat.com/' },
    ],
  },
  {
    slug: 'telegram',
    name: 'Telegram',
    url: 'https://telegram.org/',
    description: 'Cloud-based messaging, apps and web client.',
    category: 'social',
    pages: [
      { slug: 'home', name: 'Telegram', url: 'https://telegram.org/' },
      { slug: 'apps', name: 'Telegram Apps', url: 'https://telegram.org/apps' },
      { slug: 'web', name: 'Telegram Web', url: 'https://web.telegram.org/' },
    ],
  },
  {
    slug: 'whatsapp',
    name: 'WhatsApp',
    url: 'https://www.whatsapp.com/',
    description: 'Messaging and calls, plus WhatsApp Web and downloads.',
    category: 'social',
    pages: [
      { slug: 'home', name: 'WhatsApp', url: 'https://www.whatsapp.com/' },
      { slug: 'download', name: 'WhatsApp Download', url: 'https://www.whatsapp.com/download' },
      { slug: 'web', name: 'WhatsApp Web', url: 'https://web.whatsapp.com/' },
    ],
  },
  {
    slug: 'x-twitter',
    name: 'X (Twitter)',
    url: 'https://x.com/',
    description: 'The X (formerly Twitter) social platform.',
    category: 'social',
    pages: [
      { slug: 'home', name: 'X', url: 'https://x.com/' },
      { slug: 'explore', name: 'X Explore', url: 'https://x.com/explore' },
      { slug: 'about', name: 'About X', url: 'https://about.x.com/' },
    ],
  },
  {
    slug: 'netflix',
    name: 'Netflix',
    url: 'https://www.netflix.com/',
    description: 'Streaming movies and TV shows, sign-in and help center.',
    category: 'video',
    tier: 'primary',
    pages: [
      { slug: 'home', name: 'Netflix', url: 'https://www.netflix.com/' },
      { slug: 'login', name: 'Netflix Sign In', url: 'https://www.netflix.com/login' },
      { slug: 'help', name: 'Netflix Help Center', url: 'https://help.netflix.com/' },
    ],
  },
  {
    slug: 'youtube',
    name: 'YouTube',
    url: 'https://www.youtube.com/',
    description: 'Video sharing and streaming, including YouTube Music.',
    category: 'video',
    tier: 'primary',
    pages: [
      { slug: 'home', name: 'YouTube', url: 'https://www.youtube.com/' },
      { slug: 'music', name: 'YouTube Music', url: 'https://music.youtube.com/' },
      { slug: 'studio', name: 'YouTube Studio', url: 'https://studio.youtube.com/' },
    ],
  },
  {
    slug: 'crunchyroll',
    name: 'Crunchyroll',
    url: 'https://www.crunchyroll.com/',
    description: 'Anime streaming and manga.',
    category: 'video',
    pages: [
      { slug: 'home', name: 'Crunchyroll', url: 'https://www.crunchyroll.com/' },
      { slug: 'videos', name: 'Crunchyroll Popular', url: 'https://www.crunchyroll.com/videos/popular' },
      { slug: 'help', name: 'Crunchyroll Help', url: 'https://help.crunchyroll.com/' },
    ],
  },
  {
    slug: 'dailymotion',
    name: 'Dailymotion',
    url: 'https://www.dailymotion.com/',
    description: 'Video sharing and discovery.',
    category: 'video',
    pages: [
      { slug: 'home', name: 'Dailymotion', url: 'https://www.dailymotion.com/' },
      { slug: 'videos', name: 'Dailymotion Videos', url: 'https://www.dailymotion.com/videos' },
      { slug: 'about', name: 'About Dailymotion', url: 'https://about.dailymotion.com/' },
    ],
  },
  {
    slug: 'disneyplus',
    name: 'Disney+',
    url: 'https://www.disneyplus.com/',
    description: 'Streaming from Disney, Pixar, Marvel and Star Wars.',
    category: 'video',
    pages: [
      { slug: 'home', name: 'Disney+', url: 'https://www.disneyplus.com/' },
      { slug: 'login', name: 'Disney+ Login', url: 'https://www.disneyplus.com/login' },
      { slug: 'help', name: 'Disney+ Help', url: 'https://help.disneyplus.com/' },
    ],
  },
  {
    slug: 'plex',
    name: 'Plex',
    url: 'https://www.plex.tv/',
    description: 'Personal media server and free streaming.',
    category: 'video',
    pages: [
      { slug: 'home', name: 'Plex', url: 'https://www.plex.tv/' },
      { slug: 'downloads', name: 'Plex Downloads', url: 'https://www.plex.tv/media-server-downloads/' },
      { slug: 'watch-free', name: 'Plex Watch Free', url: 'https://watch.plex.tv/' },
    ],
  },
  {
    slug: 'ted',
    name: 'TED',
    url: 'https://www.ted.com/',
    description: 'TED Talks: ideas worth spreading.',
    category: 'video',
    pages: [
      { slug: 'home', name: 'TED', url: 'https://www.ted.com/' },
      { slug: 'talks', name: 'TED Talks', url: 'https://www.ted.com/talks' },
      { slug: 'about', name: 'About TED', url: 'https://www.ted.com/about' },
    ],
  },
  {
    slug: 'twitch',
    name: 'Twitch',
    url: 'https://www.twitch.tv/',
    description: 'Live streaming for gaming and creators.',
    category: 'video',
    pages: [
      { slug: 'home', name: 'Twitch', url: 'https://www.twitch.tv/' },
      { slug: 'directory', name: 'Twitch Browse', url: 'https://www.twitch.tv/directory' },
      { slug: 'downloads', name: 'Twitch Downloads', url: 'https://www.twitch.tv/downloads' },
    ],
  },
  {
    slug: 'vimeo',
    name: 'Vimeo',
    url: 'https://vimeo.com/',
    description: 'Video hosting and creation for professionals.',
    category: 'video',
    pages: [
      { slug: 'home', name: 'Vimeo', url: 'https://vimeo.com/' },
      { slug: 'features', name: 'Vimeo Features', url: 'https://vimeo.com/features' },
      { slug: 'upgrade', name: 'Vimeo Pricing', url: 'https://vimeo.com/upgrade' },
    ],
  },
  {
    slug: 'spotify',
    name: 'Spotify',
    url: 'https://www.spotify.com/us/',
    description: 'Music and podcast streaming, the web player and support.',
    category: 'music',
    tier: 'primary',
    pages: [
      { slug: 'home', name: 'Spotify', url: 'https://www.spotify.com/us/' },
      { slug: 'web-player', name: 'Spotify Web Player', url: 'https://open.spotify.com/' },
      { slug: 'support', name: 'Spotify Support', url: 'https://support.spotify.com/' },
    ],
  },
  {
    slug: 'audacity',
    name: 'Audacity',
    url: 'https://www.audacityteam.org/',
    description: 'The free, open-source audio editor.',
    category: 'music',
    pages: [
      { slug: 'home', name: 'Audacity', url: 'https://www.audacityteam.org/' },
      { slug: 'download', name: 'Audacity Download', url: 'https://www.audacityteam.org/download/' },
      { slug: 'help', name: 'Audacity Help', url: 'https://support.audacityteam.org/' },
    ],
  },
  {
    slug: 'bandcamp',
    name: 'Bandcamp',
    url: 'https://bandcamp.com/',
    description: 'Buy music directly from artists and labels.',
    category: 'music',
    pages: [
      { slug: 'home', name: 'Bandcamp', url: 'https://bandcamp.com/' },
      { slug: 'discover', name: 'Bandcamp Discover', url: 'https://bandcamp.com/discover' },
      { slug: 'daily', name: 'Bandcamp Daily', url: 'https://daily.bandcamp.com/' },
    ],
  },
  {
    slug: 'deezer',
    name: 'Deezer',
    url: 'https://www.deezer.com/',
    description: 'Music streaming with playlists and podcasts.',
    category: 'music',
    pages: [
      { slug: 'home', name: 'Deezer', url: 'https://www.deezer.com/' },
      { slug: 'offers', name: 'Deezer Plans', url: 'https://www.deezer.com/offers' },
      { slug: 'support', name: 'Deezer Support', url: 'https://support.deezer.com/' },
    ],
  },
  {
    slug: 'lastfm',
    name: 'Last.fm',
    url: 'https://www.last.fm/',
    description: 'Music tracking, charts and recommendations.',
    category: 'music',
    pages: [
      { slug: 'home', name: 'Last.fm', url: 'https://www.last.fm/' },
      { slug: 'music', name: 'Last.fm Music', url: 'https://www.last.fm/music' },
      { slug: 'charts', name: 'Last.fm Charts', url: 'https://www.last.fm/charts' },
    ],
  },
  {
    slug: 'soundcloud',
    name: 'SoundCloud',
    url: 'https://soundcloud.com/',
    description: 'Music and audio sharing for creators.',
    category: 'music',
    pages: [
      { slug: 'home', name: 'SoundCloud', url: 'https://soundcloud.com/' },
      { slug: 'discover', name: 'SoundCloud Discover', url: 'https://soundcloud.com/discover' },
      { slug: 'upload', name: 'SoundCloud Upload', url: 'https://soundcloud.com/upload' },
    ],
  },
  {
    slug: 'steam',
    name: 'Steam',
    url: 'https://store.steampowered.com/',
    description: 'The Steam store, community and help pages for PC gaming.',
    category: 'gaming',
    tier: 'primary',
    pages: [
      { slug: 'store', name: 'Steam Store', url: 'https://store.steampowered.com/' },
      { slug: 'community', name: 'Steam Community', url: 'https://steamcommunity.com/' },
      { slug: 'help', name: 'Steam Support', url: 'https://help.steampowered.com/' },
    ],
  },
  {
    slug: 'ea',
    name: 'EA',
    url: 'https://www.ea.com/',
    description: 'EA games including FC, Sims and Battlefield.',
    category: 'gaming',
    pages: [
      { slug: 'home', name: 'EA', url: 'https://www.ea.com/' },
      { slug: 'games', name: 'EA Games', url: 'https://www.ea.com/games' },
      { slug: 'help', name: 'EA Help', url: 'https://help.ea.com/en/' },
    ],
  },
  {
    slug: 'epicgames',
    name: 'Epic Games',
    url: 'https://www.epicgames.com/',
    description: 'Fortnite, the Epic Games Store and Unreal Engine.',
    category: 'gaming',
    pages: [
      { slug: 'home', name: 'Epic Games', url: 'https://www.epicgames.com/site/en-US/home' },
      { slug: 'store', name: 'Epic Games Store', url: 'https://store.epicgames.com/en-US/' },
      { slug: 'help', name: 'Epic Games Help', url: 'https://www.epicgames.com/help/en-US/' },
    ],
  },
  {
    slug: 'minecraft',
    name: 'Minecraft',
    url: 'https://www.minecraft.net/',
    description: 'The official Minecraft site and downloads.',
    category: 'gaming',
    pages: [
      { slug: 'home', name: 'Minecraft', url: 'https://www.minecraft.net/en-us' },
      { slug: 'download', name: 'Minecraft Download', url: 'https://www.minecraft.net/en-us/download' },
      { slug: 'help', name: 'Minecraft Help', url: 'https://help.minecraft.net/hc/en-us' },
    ],
  },
  {
    slug: 'nintendo',
    name: 'Nintendo',
    url: 'https://www.nintendo.com/',
    description: 'Nintendo Switch, games and eShop.',
    category: 'gaming',
    pages: [
      { slug: 'home', name: 'Nintendo', url: 'https://www.nintendo.com/us/' },
      { slug: 'games', name: 'Nintendo Games', url: 'https://www.nintendo.com/us/store/games/' },
      { slug: 'support', name: 'Nintendo Support', url: 'https://en-americas-support.nintendo.com/' },
    ],
  },
  {
    slug: 'playstation',
    name: 'PlayStation',
    url: 'https://www.playstation.com/',
    description: 'PlayStation consoles, games and PSN.',
    category: 'gaming',
    pages: [
      { slug: 'home', name: 'PlayStation', url: 'https://www.playstation.com/en-us/' },
      { slug: 'games', name: 'PlayStation Games', url: 'https://www.playstation.com/en-us/games/' },
      { slug: 'support', name: 'PlayStation Support', url: 'https://www.playstation.com/en-us/support/' },
    ],
  },
  {
    slug: 'roblox',
    name: 'Roblox',
    url: 'https://www.roblox.com/',
    description: 'The Roblox game platform and creator tools.',
    category: 'gaming',
    pages: [
      { slug: 'home', name: 'Roblox', url: 'https://www.roblox.com/' },
      { slug: 'discover', name: 'Roblox Discover', url: 'https://www.roblox.com/discover' },
      { slug: 'create', name: 'Roblox Create', url: 'https://create.roblox.com/' },
    ],
  },
  {
    slug: 'ubisoft',
    name: 'Ubisoft',
    url: 'https://www.ubisoft.com/',
    description: 'Assassins Creed, Far Cry and Ubisoft Connect.',
    category: 'gaming',
    pages: [
      { slug: 'home', name: 'Ubisoft', url: 'https://www.ubisoft.com/en-us/' },
      { slug: 'games', name: 'Ubisoft Games', url: 'https://www.ubisoft.com/en-us/games' },
      { slug: 'support', name: 'Ubisoft Support', url: 'https://www.ubisoft.com/en-us/help' },
    ],
  },
  {
    slug: 'xbox',
    name: 'Xbox',
    url: 'https://www.xbox.com/',
    description: 'Xbox consoles, Game Pass and support.',
    category: 'gaming',
    pages: [
      { slug: 'home', name: 'Xbox', url: 'https://www.xbox.com/en-US' },
      { slug: 'gamepass', name: 'Xbox Game Pass', url: 'https://www.xbox.com/en-US/xbox-game-pass' },
      { slug: 'support', name: 'Xbox Support', url: 'https://support.xbox.com/en-US' },
    ],
  },
  {
    slug: 'anthropic',
    name: 'Anthropic',
    url: 'https://www.anthropic.com/',
    description: 'Claude and AI safety research.',
    category: 'ai',
    pages: [
      { slug: 'home', name: 'Anthropic', url: 'https://www.anthropic.com/' },
      { slug: 'claude', name: 'Claude', url: 'https://www.anthropic.com/claude' },
      { slug: 'docs', name: 'Anthropic Docs', url: 'https://docs.anthropic.com/' },
    ],
  },
  {
    slug: 'deepmind',
    name: 'DeepMind',
    url: 'https://deepmind.google/',
    description: 'AI research and the Gemini models.',
    category: 'ai',
    pages: [
      { slug: 'home', name: 'Google DeepMind', url: 'https://deepmind.google/' },
      { slug: 'gemini', name: 'Gemini Models', url: 'https://deepmind.google/technologies/gemini/' },
      { slug: 'research', name: 'DeepMind Research', url: 'https://deepmind.google/research/' },
    ],
  },
  {
    slug: 'huggingface',
    name: 'Hugging Face',
    url: 'https://huggingface.co/',
    description: 'Models, datasets and the open ML community.',
    category: 'ai',
    pages: [
      { slug: 'home', name: 'Hugging Face', url: 'https://huggingface.co/' },
      { slug: 'models', name: 'Hugging Face Models', url: 'https://huggingface.co/models' },
      { slug: 'datasets', name: 'Hugging Face Datasets', url: 'https://huggingface.co/datasets' },
    ],
  },
  {
    slug: 'midjourney',
    name: 'Midjourney',
    url: 'https://www.midjourney.com/',
    description: 'AI image generation.',
    category: 'ai',
    pages: [
      { slug: 'home', name: 'Midjourney', url: 'https://www.midjourney.com/home' },
      { slug: 'showcase', name: 'Midjourney Showcase', url: 'https://www.midjourney.com/showcase' },
      { slug: 'docs', name: 'Midjourney Docs', url: 'https://docs.midjourney.com/' },
    ],
  },
  {
    slug: 'openai',
    name: 'OpenAI',
    url: 'https://openai.com/',
    description: 'ChatGPT, the OpenAI API and research.',
    category: 'ai',
    pages: [
      { slug: 'home', name: 'OpenAI', url: 'https://openai.com/' },
      { slug: 'chatgpt', name: 'ChatGPT', url: 'https://openai.com/chatgpt/overview/' },
      { slug: 'api', name: 'OpenAI Platform', url: 'https://platform.openai.com/docs/overview' },
    ],
  },
  {
    slug: 'perplexity',
    name: 'Perplexity',
    url: 'https://www.perplexity.ai/',
    description: 'AI-powered answer engine.',
    category: 'ai',
    pages: [
      { slug: 'home', name: 'Perplexity', url: 'https://www.perplexity.ai/' },
      { slug: 'discover', name: 'Perplexity Discover', url: 'https://www.perplexity.ai/discover' },
      { slug: 'hub', name: 'Perplexity Help', url: 'https://www.perplexity.ai/hub/faq' },
    ],
  },
  {
    slug: 'stability',
    name: 'Stability AI',
    url: 'https://stability.ai/',
    description: 'Open generative models including Stable Diffusion.',
    category: 'ai',
    pages: [
      { slug: 'home', name: 'Stability AI', url: 'https://stability.ai/' },
      { slug: 'news', name: 'Stability AI News', url: 'https://stability.ai/news' },
      { slug: 'models', name: 'Stability AI Models', url: 'https://stability.ai/stable-image' },
    ],
  },
  {
    slug: 'github',
    name: 'GitHub',
    url: 'https://github.com/',
    description: 'Code hosting and collaboration for developers, plus Gists and Docs.',
    category: 'developer',
    tier: 'primary',
    pages: [
      { slug: 'home', name: 'GitHub', url: 'https://github.com/' },
      { slug: 'explore', name: 'GitHub Explore', url: 'https://github.com/explore' },
      { slug: 'docs', name: 'GitHub Docs', url: 'https://docs.github.com/' },
    ],
  },
  {
    slug: 'cloudflare',
    name: 'Cloudflare',
    url: 'https://www.cloudflare.com/',
    description: 'CDN, DNS and security for a large share of the web.',
    category: 'developer',
    pages: [
      { slug: 'home', name: 'Cloudflare', url: 'https://www.cloudflare.com/' },
      { slug: 'plans', name: 'Cloudflare Plans', url: 'https://www.cloudflare.com/plans/' },
      { slug: 'docs', name: 'Cloudflare Docs', url: 'https://developers.cloudflare.com/' },
    ],
  },
  {
    slug: 'docker',
    name: 'Docker',
    url: 'https://www.docker.com/',
    description: 'Containers: Docker Hub, docs and downloads.',
    category: 'developer',
    pages: [
      { slug: 'home', name: 'Docker', url: 'https://www.docker.com/' },
      { slug: 'hub', name: 'Docker Hub', url: 'https://hub.docker.com/' },
      { slug: 'docs', name: 'Docker Docs', url: 'https://docs.docker.com/' },
    ],
  },
  {
    slug: 'gitlab',
    name: 'GitLab',
    url: 'https://about.gitlab.com/',
    description: 'DevOps platform: repositories, CI/CD and docs.',
    category: 'developer',
    pages: [
      { slug: 'home', name: 'GitLab', url: 'https://about.gitlab.com/' },
      { slug: 'app', name: 'GitLab.com', url: 'https://gitlab.com/' },
      { slug: 'docs', name: 'GitLab Docs', url: 'https://docs.gitlab.com/' },
    ],
  },
  {
    slug: 'mdn',
    name: 'MDN Web Docs',
    url: 'https://developer.mozilla.org/',
    description: 'Web documentation for HTML, CSS and JavaScript.',
    category: 'developer',
    pages: [
      { slug: 'home', name: 'MDN Web Docs', url: 'https://developer.mozilla.org/' },
      { slug: 'javascript', name: 'MDN JavaScript', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript' },
      { slug: 'html', name: 'MDN HTML', url: 'https://developer.mozilla.org/en-US/docs/Web/HTML' },
    ],
  },
  {
    slug: 'nodejs',
    name: 'Node.js',
    url: 'https://nodejs.org/',
    description: 'The Node.js JavaScript runtime.',
    category: 'developer',
    pages: [
      { slug: 'home', name: 'Node.js', url: 'https://nodejs.org/' },
      { slug: 'download', name: 'Node.js Download', url: 'https://nodejs.org/en/download' },
      { slug: 'docs', name: 'Node.js Docs', url: 'https://nodejs.org/docs/latest/api/' },
    ],
  },
  {
    slug: 'npm',
    name: 'npm',
    url: 'https://www.npmjs.com/',
    description: 'The JavaScript package registry.',
    category: 'developer',
    pages: [
      { slug: 'home', name: 'npm', url: 'https://www.npmjs.com/' },
      { slug: 'react', name: 'npm: react', url: 'https://www.npmjs.com/package/react' },
      { slug: 'docs', name: 'npm Docs', url: 'https://docs.npmjs.com/' },
    ],
  },
  {
    slug: 'python',
    name: 'Python',
    url: 'https://www.python.org/',
    description: 'The Python programming language.',
    category: 'developer',
    pages: [
      { slug: 'home', name: 'Python.org', url: 'https://www.python.org/' },
      { slug: 'downloads', name: 'Python Downloads', url: 'https://www.python.org/downloads/' },
      { slug: 'docs', name: 'Python Docs', url: 'https://docs.python.org/3/' },
    ],
  },
  {
    slug: 'adobe',
    name: 'Adobe',
    url: 'https://www.adobe.com/',
    description: 'Creative Cloud, Photoshop, Acrobat and Express.',
    category: 'cloud',
    pages: [
      { slug: 'home', name: 'Adobe', url: 'https://www.adobe.com/' },
      { slug: 'creativecloud', name: 'Adobe Creative Cloud', url: 'https://www.adobe.com/creativecloud.html' },
      { slug: 'help', name: 'Adobe Help', url: 'https://helpx.adobe.com/' },
    ],
  },
  {
    slug: 'aws',
    name: 'AWS',
    url: 'https://aws.amazon.com/',
    description: 'AWS cloud products, pricing and documentation.',
    category: 'cloud',
    pages: [
      { slug: 'home', name: 'AWS', url: 'https://aws.amazon.com/' },
      { slug: 'products', name: 'AWS Products', url: 'https://aws.amazon.com/products/' },
      { slug: 'docs', name: 'AWS Documentation', url: 'https://docs.aws.amazon.com/' },
    ],
  },
  {
    slug: 'canva',
    name: 'Canva',
    url: 'https://www.canva.com/',
    description: 'Online graphic design and templates.',
    category: 'cloud',
    pages: [
      { slug: 'home', name: 'Canva', url: 'https://www.canva.com/' },
      { slug: 'pricing', name: 'Canva Pricing', url: 'https://www.canva.com/pricing/' },
      { slug: 'templates', name: 'Canva Templates', url: 'https://www.canva.com/templates/' },
    ],
  },
  {
    slug: 'figma',
    name: 'Figma',
    url: 'https://www.figma.com/',
    description: 'Collaborative interface design in the browser.',
    category: 'cloud',
    pages: [
      { slug: 'home', name: 'Figma', url: 'https://www.figma.com/' },
      { slug: 'pricing', name: 'Figma Pricing', url: 'https://www.figma.com/pricing/' },
      { slug: 'downloads', name: 'Figma Downloads', url: 'https://www.figma.com/downloads/' },
    ],
  },
  {
    slug: 'notion',
    name: 'Notion',
    url: 'https://www.notion.com/',
    description: 'Notes, docs, wikis and project management.',
    category: 'cloud',
    pages: [
      { slug: 'home', name: 'Notion', url: 'https://www.notion.com/' },
      { slug: 'pricing', name: 'Notion Pricing', url: 'https://www.notion.com/pricing' },
      { slug: 'help', name: 'Notion Help', url: 'https://www.notion.com/help' },
    ],
  },
  {
    slug: 'slack',
    name: 'Slack',
    url: 'https://slack.com/',
    description: 'Team messaging and collaboration.',
    category: 'cloud',
    pages: [
      { slug: 'home', name: 'Slack', url: 'https://slack.com/' },
      { slug: 'pricing', name: 'Slack Pricing', url: 'https://slack.com/pricing' },
      { slug: 'help', name: 'Slack Help Center', url: 'https://slack.com/help' },
    ],
  },
  {
    slug: 'zoom',
    name: 'Zoom',
    url: 'https://zoom.us/',
    description: 'Video meetings, webinars and phone.',
    category: 'cloud',
    pages: [
      { slug: 'home', name: 'Zoom', url: 'https://zoom.us/' },
      { slug: 'pricing', name: 'Zoom Pricing', url: 'https://zoom.us/pricing' },
      { slug: 'download', name: 'Zoom Download', url: 'https://zoom.us/download' },
    ],
  },
  {
    slug: 'apple',
    name: 'Apple',
    url: 'https://www.apple.com/',
    description: 'Apple.com, iCloud and Apple Support.',
    category: 'tech',
    tier: 'primary',
    pages: [
      { slug: 'home', name: 'Apple', url: 'https://www.apple.com/' },
      { slug: 'icloud', name: 'iCloud', url: 'https://www.icloud.com/' },
      { slug: 'support', name: 'Apple Support', url: 'https://support.apple.com/' },
    ],
  },
  {
    slug: 'microsoft',
    name: 'Microsoft',
    url: 'https://www.microsoft.com/',
    description: 'Microsoft.com, Microsoft 365 (Office) and Microsoft Learn.',
    category: 'tech',
    tier: 'primary',
    pages: [
      { slug: 'home', name: 'Microsoft', url: 'https://www.microsoft.com/' },
      { slug: 'office', name: 'Microsoft 365 / Office', url: 'https://www.office.com/' },
      { slug: 'learn', name: 'Microsoft Learn', url: 'https://learn.microsoft.com/' },
    ],
  },
  {
    slug: 'amd',
    name: 'AMD',
    url: 'https://www.amd.com/',
    description: 'Ryzen and Radeon processors and graphics.',
    category: 'tech',
    pages: [
      { slug: 'home', name: 'AMD', url: 'https://www.amd.com/en.html' },
      { slug: 'ryzen', name: 'AMD Ryzen', url: 'https://www.amd.com/en/products/processors/desktops/ryzen.html' },
      { slug: 'drivers', name: 'AMD Drivers', url: 'https://www.amd.com/en/support' },
    ],
  },
  {
    slug: 'dell',
    name: 'Dell',
    url: 'https://www.dell.com/',
    description: 'Laptops, desktops and enterprise hardware.',
    category: 'tech',
    pages: [
      { slug: 'home', name: 'Dell', url: 'https://www.dell.com/en-us' },
      { slug: 'laptops', name: 'Dell Laptops', url: 'https://www.dell.com/en-us/shop/scc/sc/laptops' },
      { slug: 'support', name: 'Dell Support', url: 'https://www.dell.com/support/home/en-us' },
    ],
  },
  {
    slug: 'intel',
    name: 'Intel',
    url: 'https://www.intel.com/',
    description: 'Processors and chip technology.',
    category: 'tech',
    pages: [
      { slug: 'home', name: 'Intel', url: 'https://www.intel.com/content/www/us/en/homepage.html' },
      { slug: 'products', name: 'Intel Products', url: 'https://www.intel.com/content/www/us/en/products/overview.html' },
      { slug: 'support', name: 'Intel Support', url: 'https://www.intel.com/content/www/us/en/support.html' },
    ],
  },
  {
    slug: 'lenovo',
    name: 'Lenovo',
    url: 'https://www.lenovo.com/',
    description: 'ThinkPad laptops and computing hardware.',
    category: 'tech',
    pages: [
      { slug: 'home', name: 'Lenovo', url: 'https://www.lenovo.com/us/en/' },
      { slug: 'laptops', name: 'Lenovo Laptops', url: 'https://www.lenovo.com/us/en/c/laptops/' },
      { slug: 'support', name: 'Lenovo Support', url: 'https://support.lenovo.com/us/en' },
    ],
  },
  {
    slug: 'nvidia',
    name: 'NVIDIA',
    url: 'https://www.nvidia.com/',
    description: 'GPUs, GeForce and AI computing.',
    category: 'tech',
    pages: [
      { slug: 'home', name: 'NVIDIA', url: 'https://www.nvidia.com/en-us/' },
      { slug: 'geforce', name: 'GeForce', url: 'https://www.nvidia.com/en-us/geforce/' },
      { slug: 'drivers', name: 'NVIDIA Drivers', url: 'https://www.nvidia.com/en-us/drivers/' },
    ],
  },
  {
    slug: 'samsung',
    name: 'Samsung',
    url: 'https://www.samsung.com/',
    description: 'Phones, TVs and appliances from Samsung.',
    category: 'tech',
    pages: [
      { slug: 'home', name: 'Samsung', url: 'https://www.samsung.com/' },
      { slug: 'galaxy', name: 'Samsung Galaxy', url: 'https://www.samsung.com/us/smartphones/' },
      { slug: 'support', name: 'Samsung Support', url: 'https://www.samsung.com/us/support/' },
    ],
  },
  {
    slug: 'sony',
    name: 'Sony',
    url: 'https://www.sony.com/',
    description: 'Consumer electronics, cameras and entertainment.',
    category: 'tech',
    pages: [
      { slug: 'home', name: 'Sony', url: 'https://www.sony.com/' },
      { slug: 'electronics', name: 'Sony Electronics', url: 'https://electronics.sony.com/' },
      { slug: 'support', name: 'Sony Support', url: 'https://www.sony.com/electronics/support' },
    ],
  },
  {
    slug: 'apnews',
    name: 'AP News',
    url: 'https://apnews.com/',
    description: 'The Associated Press newswire.',
    category: 'news',
    pages: [
      { slug: 'home', name: 'AP News', url: 'https://apnews.com/' },
      { slug: 'world', name: 'AP World News', url: 'https://apnews.com/hub/world-news' },
      { slug: 'technology', name: 'AP Technology', url: 'https://apnews.com/hub/technology' },
    ],
  },
  {
    slug: 'bbc',
    name: 'BBC',
    url: 'https://www.bbc.com/',
    description: 'BBC News, Sport and world coverage.',
    category: 'news',
    pages: [
      { slug: 'home', name: 'BBC', url: 'https://www.bbc.com/' },
      { slug: 'news', name: 'BBC News', url: 'https://www.bbc.com/news' },
      { slug: 'sport', name: 'BBC Sport', url: 'https://www.bbc.com/sport' },
    ],
  },
  {
    slug: 'cnn',
    name: 'CNN',
    url: 'https://www.cnn.com/',
    description: 'Breaking news, world and business coverage.',
    category: 'news',
    pages: [
      { slug: 'home', name: 'CNN', url: 'https://www.cnn.com/' },
      { slug: 'world', name: 'CNN World', url: 'https://www.cnn.com/world' },
      { slug: 'business', name: 'CNN Business', url: 'https://www.cnn.com/business' },
    ],
  },
  {
    slug: 'npr',
    name: 'NPR',
    url: 'https://www.npr.org/',
    description: 'National Public Radio news and programmes.',
    category: 'news',
    pages: [
      { slug: 'home', name: 'NPR', url: 'https://www.npr.org/' },
      { slug: 'news', name: 'NPR News', url: 'https://www.npr.org/sections/news/' },
      { slug: 'music', name: 'NPR Music', url: 'https://www.npr.org/music/' },
    ],
  },
  {
    slug: 'techcrunch',
    name: 'TechCrunch',
    url: 'https://techcrunch.com/',
    description: 'Startup and technology news.',
    category: 'news',
    pages: [
      { slug: 'home', name: 'TechCrunch', url: 'https://techcrunch.com/' },
      { slug: 'startups', name: 'TechCrunch Startups', url: 'https://techcrunch.com/category/startups/' },
      { slug: 'venture', name: 'TechCrunch Venture', url: 'https://techcrunch.com/category/venture/' },
    ],
  },
  {
    slug: 'guardian',
    name: 'The Guardian',
    url: 'https://www.theguardian.com/',
    description: 'Independent news from The Guardian.',
    category: 'news',
    pages: [
      { slug: 'home', name: 'The Guardian', url: 'https://www.theguardian.com/international' },
      { slug: 'world', name: 'Guardian World News', url: 'https://www.theguardian.com/world' },
      { slug: 'technology', name: 'Guardian Technology', url: 'https://www.theguardian.com/uk/technology' },
    ],
  },
  {
    slug: 'theverge',
    name: 'The Verge',
    url: 'https://www.theverge.com/',
    description: 'Technology, science and culture news.',
    category: 'news',
    pages: [
      { slug: 'home', name: 'The Verge', url: 'https://www.theverge.com/' },
      { slug: 'tech', name: 'The Verge Tech', url: 'https://www.theverge.com/tech' },
      { slug: 'reviews', name: 'The Verge Reviews', url: 'https://www.theverge.com/reviews' },
    ],
  },
  {
    slug: 'alibaba',
    name: 'Alibaba',
    url: 'https://www.alibaba.com/',
    description: 'Global B2B wholesale marketplace.',
    category: 'shopping',
    pages: [
      { slug: 'home', name: 'Alibaba', url: 'https://www.alibaba.com/' },
      { slug: 'products', name: 'Alibaba Products', url: 'https://www.alibaba.com/Products' },
      { slug: 'sale', name: 'Alibaba Sale', url: 'https://sale.alibaba.com/' },
    ],
  },
  {
    slug: 'aliexpress',
    name: 'AliExpress',
    url: 'https://www.aliexpress.com/',
    description: 'Consumer marketplace for global shipping.',
    category: 'shopping',
    pages: [
      { slug: 'home', name: 'AliExpress', url: 'https://www.aliexpress.com/' },
      { slug: 'bestsellers', name: 'AliExpress Best Sellers', url: 'https://www.aliexpress.com/gcp/300000512/bestdeals' },
    ],
  },
  {
    slug: 'ebay',
    name: 'eBay',
    url: 'https://www.ebay.com/',
    description: 'Online auctions and marketplace.',
    category: 'shopping',
    pages: [
      { slug: 'home', name: 'eBay', url: 'https://www.ebay.com/' },
      { slug: 'deals', name: 'eBay Deals', url: 'https://www.ebay.com/deals' },
      { slug: 'help', name: 'eBay Help', url: 'https://www.ebay.com/help/home' },
    ],
  },
  {
    slug: 'ikea',
    name: 'IKEA',
    url: 'https://www.ikea.com/',
    description: 'Flat-pack furniture and home furnishings.',
    category: 'shopping',
    pages: [
      { slug: 'home', name: 'IKEA', url: 'https://www.ikea.com/us/en/' },
      { slug: 'rooms', name: 'IKEA Rooms', url: 'https://www.ikea.com/us/en/rooms/' },
      { slug: 'customer-service', name: 'IKEA Customer Service', url: 'https://www.ikea.com/us/en/customer-service/' },
    ],
  },
  {
    slug: 'newegg',
    name: 'Newegg',
    url: 'https://www.newegg.com/',
    description: 'Computer hardware and consumer electronics.',
    category: 'shopping',
    pages: [
      { slug: 'home', name: 'Newegg', url: 'https://www.newegg.com/' },
      { slug: 'deals', name: 'Newegg Deals', url: 'https://www.newegg.com/todays-deals' },
      { slug: 'help', name: 'Newegg Help', url: 'https://kb.newegg.com/' },
    ],
  },
  {
    slug: 'shopify',
    name: 'Shopify',
    url: 'https://www.shopify.com/',
    description: 'Ecommerce platform for online stores.',
    category: 'shopping',
    pages: [
      { slug: 'home', name: 'Shopify', url: 'https://www.shopify.com/' },
      { slug: 'pricing', name: 'Shopify Pricing', url: 'https://www.shopify.com/pricing' },
      { slug: 'help', name: 'Shopify Help Center', url: 'https://help.shopify.com/en' },
    ],
  },
  {
    slug: 'coinbase',
    name: 'Coinbase',
    url: 'https://www.coinbase.com/',
    description: 'Cryptocurrency exchange and wallet.',
    category: 'finance',
    pages: [
      { slug: 'home', name: 'Coinbase', url: 'https://www.coinbase.com/' },
      { slug: 'prices', name: 'Coinbase Prices', url: 'https://www.coinbase.com/explore' },
      { slug: 'learn', name: 'Coinbase Learn', url: 'https://www.coinbase.com/learn' },
    ],
  },
  {
    slug: 'mastercard',
    name: 'Mastercard',
    url: 'https://www.mastercard.com/',
    description: 'Global payments technology.',
    category: 'finance',
    pages: [
      { slug: 'home', name: 'Mastercard', url: 'https://www.mastercard.com/global/en.html' },
      { slug: 'personal', name: 'Mastercard Personal', url: 'https://www.mastercard.us/en-us/personal.html' },
      { slug: 'business', name: 'Mastercard Business', url: 'https://www.mastercard.us/en-us/business.html' },
    ],
  },
  {
    slug: 'paypal',
    name: 'PayPal',
    url: 'https://www.paypal.com/',
    description: 'Online payments and money transfers.',
    category: 'finance',
    pages: [
      { slug: 'home', name: 'PayPal', url: 'https://www.paypal.com/us/home' },
      { slug: 'business', name: 'PayPal Business', url: 'https://www.paypal.com/us/business' },
      { slug: 'help', name: 'PayPal Help', url: 'https://www.paypal.com/us/cshelp/personal' },
    ],
  },
  {
    slug: 'stripe',
    name: 'Stripe',
    url: 'https://stripe.com/',
    description: 'Payments infrastructure for the internet.',
    category: 'finance',
    pages: [
      { slug: 'home', name: 'Stripe', url: 'https://stripe.com/' },
      { slug: 'pricing', name: 'Stripe Pricing', url: 'https://stripe.com/pricing' },
      { slug: 'docs', name: 'Stripe Docs', url: 'https://docs.stripe.com/' },
    ],
  },
  {
    slug: 'visa',
    name: 'Visa',
    url: 'https://www.visa.com/',
    description: 'Global payments network.',
    category: 'finance',
    pages: [
      { slug: 'home', name: 'Visa', url: 'https://www.visa.com/' },
      { slug: 'cards', name: 'Pay with Visa', url: 'https://usa.visa.com/pay-with-visa.html' },
      { slug: 'support', name: 'Visa Support', url: 'https://usa.visa.com/support.html' },
    ],
  },
  {
    slug: 'wise',
    name: 'Wise',
    url: 'https://wise.com/',
    description: 'International money transfers and multi-currency accounts.',
    category: 'finance',
    pages: [
      { slug: 'home', name: 'Wise', url: 'https://wise.com/' },
      { slug: 'pricing', name: 'Wise Pricing', url: 'https://wise.com/us/pricing/' },
      { slug: 'help', name: 'Wise Help', url: 'https://wise.com/help/' },
    ],
  },
  {
    slug: 'xe',
    name: 'XE',
    url: 'https://www.xe.com/',
    description: 'Currency exchange rates and conversion.',
    category: 'finance',
    pages: [
      { slug: 'home', name: 'XE', url: 'https://www.xe.com/' },
      { slug: 'converter', name: 'XE Currency Converter', url: 'https://www.xe.com/currencyconverter/' },
      { slug: 'charts', name: 'XE Currency Charts', url: 'https://www.xe.com/currencycharts/' },
    ],
  },
  {
    slug: 'coursera',
    name: 'Coursera',
    url: 'https://www.coursera.org/',
    description: 'Online courses and degrees from universities.',
    category: 'learning',
    pages: [
      { slug: 'home', name: 'Coursera', url: 'https://www.coursera.org/' },
      { slug: 'browse', name: 'Coursera Browse', url: 'https://www.coursera.org/browse' },
      { slug: 'degrees', name: 'Coursera Degrees', url: 'https://www.coursera.org/degrees' },
    ],
  },
  {
    slug: 'duolingo',
    name: 'Duolingo',
    url: 'https://www.duolingo.com/',
    description: 'Free language learning.',
    category: 'learning',
    pages: [
      { slug: 'home', name: 'Duolingo', url: 'https://www.duolingo.com/' },
      { slug: 'courses', name: 'Duolingo Courses', url: 'https://www.duolingo.com/courses' },
      { slug: 'blog', name: 'Duolingo Blog', url: 'https://blog.duolingo.com/' },
    ],
  },
  {
    slug: 'edx',
    name: 'edX',
    url: 'https://www.edx.org/',
    description: 'University-level online courses.',
    category: 'learning',
    pages: [
      { slug: 'home', name: 'edX', url: 'https://www.edx.org/' },
      { slug: 'courses', name: 'edX Courses', url: 'https://www.edx.org/search' },
      { slug: 'help', name: 'edX Help', url: 'https://support.edx.org/' },
    ],
  },
  {
    slug: 'harvard',
    name: 'Harvard',
    url: 'https://www.harvard.edu/',
    description: 'Harvard University and its online learning.',
    category: 'learning',
    pages: [
      { slug: 'home', name: 'Harvard', url: 'https://www.harvard.edu/' },
      { slug: 'admissions', name: 'Harvard Admissions', url: 'https://www.harvard.edu/admissions/' },
      { slug: 'online', name: 'Harvard Online', url: 'https://pll.harvard.edu/' },
    ],
  },
  {
    slug: 'khan-academy',
    name: 'Khan Academy',
    url: 'https://www.khanacademy.org/',
    description: 'Free lessons in maths, science and more.',
    category: 'learning',
    pages: [
      { slug: 'home', name: 'Khan Academy', url: 'https://www.khanacademy.org/' },
      { slug: 'math', name: 'Khan Academy Math', url: 'https://www.khanacademy.org/math' },
      { slug: 'computing', name: 'Khan Academy Computing', url: 'https://www.khanacademy.org/computing' },
    ],
  },
  {
    slug: 'mit',
    name: 'MIT',
    url: 'https://www.mit.edu/',
    description: 'The Massachusetts Institute of Technology and OpenCourseWare.',
    category: 'learning',
    pages: [
      { slug: 'home', name: 'MIT', url: 'https://www.mit.edu/' },
      { slug: 'ocw', name: 'MIT OpenCourseWare', url: 'https://ocw.mit.edu/' },
      { slug: 'news', name: 'MIT News', url: 'https://news.mit.edu/' },
    ],
  },
  {
    slug: 'udemy',
    name: 'Udemy',
    url: 'https://www.udemy.com/',
    description: 'Online courses taught by independent instructors.',
    category: 'learning',
    pages: [
      { slug: 'home', name: 'Udemy', url: 'https://www.udemy.com/' },
      { slug: 'development', name: 'Udemy Development', url: 'https://www.udemy.com/courses/development/' },
      { slug: 'support', name: 'Udemy Support', url: 'https://support.udemy.com/' },
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
