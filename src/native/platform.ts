import { Capacitor } from '@capacitor/core';

/** 是否运行在安卓 App 里（而不是浏览器） */
export const isNativeApp = Capacitor.isNativePlatform();
