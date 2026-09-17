import { useEffect, useState } from 'react';

/**
 * 为一组 blob 创建 object URL，卸载或列表变化时自动回收。
 * URL 的创建和回收放在同一个 effect 里，React StrictMode 下重复执行 effect 也不会留下已回收的地址。
 */
export function useObjectUrls(items: { id: string; blob: Blob }[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = items.map((i) => i.id).join('|');

  useEffect(() => {
    const created = Object.fromEntries(items.map((i) => [i.id, URL.createObjectURL(i.blob)]));
    setUrls(created);
    return () => {
      for (const u of Object.values(created)) URL.revokeObjectURL(u);
    };
    // 只在图片 id 列表变化时重建
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return urls;
}
