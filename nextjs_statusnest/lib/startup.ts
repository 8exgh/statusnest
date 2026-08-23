import { getProjectionEngine } from './cqrs/projection-engine';
import { ensurePublicSites } from './public-monitors/seed';

let initialized = false;

export function initializeApp() {
  if (initialized) {
    return;
  }
  
  if (typeof window !== 'undefined') {
    return;
  }
  
  // `next build` evaluates server modules while prerendering; never touch the
  // data directory (or seed anything) during a build.
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return;
  }
  
  initialized = true;
  
  const projectionEngine = getProjectionEngine();
  projectionEngine.start().catch(console.error);
  console.log('StatusNest: Projection engine started');
  
  ensurePublicSites().catch(error => console.error('StatusNest: public monitor seed failed:', error));
}
