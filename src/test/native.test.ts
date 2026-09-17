// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { planReminders } from '../native/reminders';
import { checkForUpdate, compareVersions } from '../native/update';

const cfg = { enabled: true, hour: 20, minute: 0 };

describe('planReminders', () => {
  it('按天累计到期数，跳过已过时间和为 0 的日子', () => {
    const now = new Date(2026, 8, 17, 21, 0); // 9/17 21:00，当天 20:00 已过
    const plan = planReminders(['2026-09-10', '2026-09-18', '2026-09-18', '2026-09-20', '2026-12-01'], cfg, now, null);
    expect(plan[0]).toMatchObject({ date: '2026-09-18', count: 3 });
    expect(plan[0].at.getHours()).toBe(20);
    expect(plan.find((p) => p.date === '2026-09-19')!.count).toBe(3);
    expect(plan.find((p) => p.date === '2026-09-20')!.count).toBe(4);
    expect(plan).toHaveLength(14 - 1);
    expect(new Set(plan.map((p) => p.id)).size).toBe(plan.length);
  });

  it('当天时间未到时包含今天；没有到期内容不提醒；带考研倒计时', () => {
    const now = new Date(2026, 8, 17, 8, 0);
    expect(planReminders([], cfg, now, null)).toEqual([]);
    const plan = planReminders(['2026-09-17'], cfg, now, '2026-12-20');
    expect(plan[0].date).toBe('2026-09-17');
    expect(plan[0].body).toBe('今天有 1 条内容待复习，距考研还有 94 天');
  });
});

describe('update', () => {
  it('compareVersions', () => {
    expect(compareVersions('v0.2.0', '0.1.9')).toBeGreaterThan(0);
    expect(compareVersions('0.2.10', '0.2.9')).toBeGreaterThan(0);
    expect(compareVersions('0.2', '0.2.0')).toBe(0);
    expect(compareVersions('0.1.0', '0.2.0')).toBeLessThan(0);
  });

  it('checkForUpdate 解析 release 与 apk 地址', async () => {
    const fake = (async () =>
      new Response(
        JSON.stringify({
          tag_name: 'v0.3.0',
          html_url: 'https://github.com/x/y/releases/tag/v0.3.0',
          body: '更新说明',
          assets: [{ name: 'abinhouse-0.3.0.apk', browser_download_url: 'https://example.com/a.apk' }],
        }),
        { status: 200 },
      )) as typeof fetch;
    const info = await checkForUpdate('0.2.0', fake);
    expect(info).toMatchObject({ latest: '0.3.0', hasUpdate: true, apkUrl: 'https://example.com/a.apk', notes: '更新说明' });
    const none = await checkForUpdate('0.2.0', (async () => new Response('{}', { status: 404 })) as typeof fetch);
    expect(none.hasUpdate).toBe(false);
  });
});
