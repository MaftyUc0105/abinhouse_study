// 打包安卓 APK。用法：
//   npm run apk              构建签名的正式版 APK，输出到 release/
//   npm run apk -- --publish 同时在 GitHub 创建 Release 并上传 APK（App 内"检查更新"读取它）
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = pkg.version;
const publish = process.argv.includes('--publish');

// 开发环境都在 D 盘；可用环境变量覆盖
const env = {
  ...process.env,
  JAVA_HOME: process.env.JAVA_HOME_21 || 'D:\\dev\\jdk21',
  ANDROID_HOME: process.env.ANDROID_HOME || 'D:\\dev\\android-sdk',
  ANDROID_SDK_ROOT: process.env.ANDROID_HOME || 'D:\\dev\\android-sdk',
  GRADLE_USER_HOME: process.env.GRADLE_USER_HOME || 'D:\\dev\\gradle-home',
  VITE_BASE: '/',
};
// Windows 上环境变量名是 Path，不能再额外加一个 PATH
const pathKey = Object.keys(env).find((k) => k.toLowerCase() === 'path') ?? 'PATH';
env[pathKey] = `${path.join(env.JAVA_HOME, 'bin')}${path.delimiter}${env[pathKey]}`;

const run = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', env, ...opts });

if (!fs.existsSync('android/keystore.properties')) {
  console.error('缺少 android/keystore.properties（签名配置），无法打正式版。备份位置：D:\\dev\\keys\\keystore.properties');
  process.exit(1);
}
fs.writeFileSync('android/local.properties', `sdk.dir=${env.ANDROID_HOME.replace(/\\/g, '\\\\')}\n`);

console.log(`\n> 测试`);
run('npx vitest run');

console.log(`\n> 构建网页（v${version}）`);
run('npm run build');

console.log(`\n> 同步到安卓工程`);
run('npx cap sync android');

console.log(`\n> Gradle 打包`);
const gradlew = path.join(root, 'android', process.platform === 'win32' ? 'gradlew.bat' : 'gradlew');
run(`"${gradlew}" assembleRelease --no-daemon`, {
  cwd: path.join(root, 'android'),
});

const built = path.join(root, 'android/app/build/outputs/apk/release/app-release.apk');
if (!fs.existsSync(built)) {
  console.error('没有找到 app-release.apk，请检查上面的 Gradle 输出');
  process.exit(1);
}
fs.mkdirSync('release', { recursive: true });
const out = path.join(root, 'release', `abinhouse-${version}.apk`);
fs.copyFileSync(built, out);
console.log(`\nAPK：${out}（${(fs.statSync(out).size / 1024 / 1024).toFixed(1)} MB）`);

if (publish) {
  console.log(`\n> 发布 GitHub Release v${version}`);
  const notesFile = path.join(root, 'release', `notes-${version}.md`);
  const notes = fs.existsSync(notesFile) ? `--notes-file "${notesFile}"` : `--notes "复习本 v${version}"`;
  run(`gh release create v${version} "${out}" --title "复习本 v${version}" ${notes}`);
}
