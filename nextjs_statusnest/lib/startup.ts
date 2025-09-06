import { getProjectionEngine } from './cqrs/projection-engine';

let initialized = false;

export function initializeApp() {
  if (initialized) {
    return;
  }
  
  if (typeof window === 'undefined') {
    const projectionEngine = getProjectionEngine();
    projectionEngine.start().catch(console.error);
    
    console.log('StatusNest: Projection engine started');
    initialized = true;
  }
}