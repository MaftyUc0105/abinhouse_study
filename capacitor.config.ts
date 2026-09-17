import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.maftyuc0105.abinhouse',
  appName: '复习本',
  webDir: 'dist',
  backgroundColor: '#f6f7f9',
  android: {
    // 不允许 http 明文内容
    allowMixedContent: false,
  },
  plugins: {
    SystemBars: {
      // 注入 --safe-area-inset-* CSS 变量，页面自己留出状态栏和导航栏高度
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#2563eb',
    },
  },
};

export default config;
