import { FOOTER_BADGES_CACHE_TAG } from '../constants';
import { extractProjectFooterMeta } from '../core/extract-project-footer-meta';
export async function getRemoteFooterMeta({ configUrl, projectId, fallbackMeta = {}, revalidateSeconds = 3600, cacheTag = FOOTER_BADGES_CACHE_TAG, }) {
    if (!configUrl) {
        return fallbackMeta;
    }
    try {
        const response = await fetch(configUrl, {
            next: {
                revalidate: revalidateSeconds,
                tags: [cacheTag],
            },
            headers: {
                Accept: 'application/json',
            },
        });
        if (!response.ok) {
            throw new Error(`Remote footer badge request failed with status ${response.status}.`);
        }
        const payload = (await response.json());
        const remoteMeta = extractProjectFooterMeta(payload, projectId);
        return {
            ...fallbackMeta,
            ...remoteMeta,
        };
    }
    catch {
        return fallbackMeta;
    }
}
