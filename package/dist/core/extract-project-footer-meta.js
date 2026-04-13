export function extractProjectFooterMeta(payload, projectId) {
    if (typeof payload !== 'object' || payload === null) {
        throw new Error('Remote footer badge config is not an object.');
    }
    const config = payload;
    const projectMeta = config.projectMeta?.[projectId];
    if (typeof projectMeta !== 'object' || projectMeta === null) {
        return {};
    }
    const footerMeta = projectMeta.footer;
    if (typeof footerMeta !== 'object' || footerMeta === null) {
        return {};
    }
    const resolved = {};
    if (typeof footerMeta.copyright === 'string' && footerMeta.copyright.trim() !== '') {
        resolved.copyright = footerMeta.copyright;
    }
    if (typeof footerMeta.lastUpdated === 'string' && footerMeta.lastUpdated.trim() !== '') {
        resolved.lastUpdated = footerMeta.lastUpdated;
    }
    return resolved;
}
