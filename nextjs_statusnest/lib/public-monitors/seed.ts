import { CommandBus } from '@/lib/cqrs/command-bus';
import { PublicMonitorQueries } from './queries';
import { PUBLIC_SITES, publicPageId, publicSiteId, isValidSlug } from './sites';

/** The system-owned event stream that holds every public-monitor event. */
export const PUBLIC_MONITORS_USER_ID = 'public-monitors';

/**
 * Bring the read model in line with `PUBLIC_SITES`: register new sites and
 * pages, re-register ones whose details changed, and deactivate anything that
 * was removed from the config. Idempotent; safe to run on every startup.
 */
export async function ensurePublicSites(): Promise<void> {
  for (const site of PUBLIC_SITES) {
    if (!isValidSlug(site.slug)) throw new Error(`Invalid site slug in config: ${site.slug}`);
    for (const page of site.pages) {
      if (!isValidSlug(page.slug)) throw new Error(`Invalid page slug in config: ${site.slug}/${page.slug}`);
    }
  }
  
  const queries = new PublicMonitorQueries();
  const commandBus = new CommandBus();
  const existing = new Map(queries.getSites({ includeInactive: true }).map(s => [s.id, s]));
  const configured = new Set<string>();
  
  for (const [position, site] of PUBLIC_SITES.entries()) {
    const siteId = publicSiteId(site.slug);
    configured.add(siteId);
    const current = existing.get(siteId);
    
    const siteChanged = !current || !current.active ||
      current.name !== site.name || current.url !== site.url ||
      current.description !== site.description || current.position !== position;
    
    if (siteChanged) {
      await commandBus.dispatch({
        userId: PUBLIC_MONITORS_USER_ID,
        aggregateId: siteId,
        type: 'RegisterPublicSite',
        payload: { slug: site.slug, name: site.name, url: site.url, description: site.description, position, pages: site.pages }
      });
      console.log(`Public monitors: ${current ? 'updated' : 'registered'} ${site.slug} (${site.pages.length} pages)`);
      continue;
    }
    
    // Site unchanged: reconcile its pages individually.
    const currentPages = new Map(current.pages.map(p => [p.id, p]));
    for (const [pagePosition, page] of site.pages.entries()) {
      const pageId = publicPageId(site.slug, page.slug);
      const existingPage = currentPages.get(pageId);
      const pageChanged = !existingPage || !existingPage.active ||
        existingPage.name !== page.name || existingPage.url !== page.url || existingPage.position !== pagePosition;
      if (pageChanged) {
        await commandBus.dispatch({
          userId: PUBLIC_MONITORS_USER_ID,
          aggregateId: pageId,
          type: 'RegisterPublicPage',
          payload: { siteId, slug: page.slug, name: page.name, url: page.url, position: pagePosition }
        });
        console.log(`Public monitors: ${existingPage ? 'updated' : 'registered'} page ${pageId}`);
      }
    }
    const wanted = new Set(site.pages.map(p => publicPageId(site.slug, p.slug)));
    for (const page of current.pages) {
      if (page.active && !wanted.has(page.id)) {
        await commandBus.dispatch({
          userId: PUBLIC_MONITORS_USER_ID,
          aggregateId: page.id,
          type: 'DeactivatePublicPage',
          payload: { pageId: page.id, siteId }
        });
        console.log(`Public monitors: deactivated page ${page.id}`);
      }
    }
  }
  
  for (const site of existing.values()) {
    if (site.active && !configured.has(site.id)) {
      await commandBus.dispatch({
        userId: PUBLIC_MONITORS_USER_ID,
        aggregateId: site.id,
        type: 'DeactivatePublicSite',
        payload: { siteId: site.id }
      });
      console.log(`Public monitors: deactivated site ${site.slug}`);
    }
  }
}
