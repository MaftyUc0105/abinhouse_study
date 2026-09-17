/** 检查 GitHub Releases 上是否有新版 APK */
import { Browser } from '@capacitor/browser';

export const RELEASES_API = 'https://api.github.com/repos/MaftyUc0105/abinhouse_study/releases/latest';

export interface UpdateInfo {
  latest: string;
  current: string;
  hasUpdate: boolean;
  apkUrl: string | null;
  pageUrl: string;
  notes: string;
}

/** 比较形如 0.2.10 的版本号：a > b 返回正数 */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map((x) => parseInt(x, 10) || 0);
  const pb = b.replace(/^v/, '').split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export async function checkForUpdate(current: string, fetchImpl: typeof fetch = (...a) => fetch(...a)): Promise<UpdateInfo> {
  const res = await fetchImpl(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' });
  if (res.status === 404) return { latest: current, current, hasUpdate: false, apkUrl: null, pageUrl: '', notes: '' };
  if (!res.ok) throw new Error(`检查更新失败（${res.status}）`);
  const j = (await res.json()) as {
    tag_name: string;
    html_url: string;
    body?: string;
    assets: { name: string; browser_download_url: string }[];
  };
  const apk = j.assets.find((a) => a.name.endsWith('.apk'));
  return {
    latest: j.tag_name.replace(/^v/, ''),
    current,
    hasUpdate: compareVersions(j.tag_name, current) > 0,
    apkUrl: apk?.browser_download_url ?? null,
    pageUrl: j.html_url,
    notes: j.body ?? '',
  };
}

export async function openDownload(info: UpdateInfo) {
  await Browser.open({ url: info.apkUrl ?? info.pageUrl });
}
