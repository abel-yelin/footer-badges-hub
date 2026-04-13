import type { FooterMeta, GetRemoteFooterMetaOptions } from '../types';
export declare function getRemoteFooterMeta({ configUrl, projectId, fallbackMeta, revalidateSeconds, cacheTag, }: GetRemoteFooterMetaOptions): Promise<FooterMeta>;
