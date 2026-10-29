export const SEEN_RELEASE_KEY='solvi-seen-release-version';
export function shouldDisplayDevLog(version,storage){return !!version && storage.getItem(SEEN_RELEASE_KEY)!==version;}
export function markDevLogRead(version,storage){if(version)storage.setItem(SEEN_RELEASE_KEY,version);}
