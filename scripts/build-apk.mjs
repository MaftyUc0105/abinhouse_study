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

// 工具链放在项目旁边的 _toolchain，别再放进名字像临时文件的目录
const TOOLCHAIN = process.env.ABINHOUSE_TOOLCHAIN || path.resolve(root, '..', '_toolchain');
const sdkDir = process.env.ANDROID_HOME || path.join(TOOLCHAIN, 'android-sdk');
const env = {
  ...process.env,
  JAVA_HOME: process.env.JAVA_HOME_21 || path.join(TOOLCHAIN, 'jdk21'),
  ANDROID_HOME: sdkDir,
  ANDROID_SDK_ROOT: sdkDir,
  GRADLE_USER_HOME: process.env.GRADLE_USER_HOME || path.join(TOOLCHAIN, 'gradle-home'),
  VITE_BASE: '/',
};
if (!fs.existsSync(env.JAVA_HOME) || !fs.existsSync(sdkDir)) {
  console.error(`缺少安卓开发环境：${TOOLCHAIN}`);
  console.error('这个目录删掉只是要重新下载约 2.5 GB，代码不受影响。重建步骤见 README 的「打包 APK」一节。');
  process.exit(1);
}
// Windows 上环境变量名是 Path，不能再额外加一个 PATH
const pathKey = Object.keys(env).find((k) => k.toLowerCase() === 'path') ?? 'PATH';
env[pathKey] = `${path.join(env.JAVA_HOME, 'bin')}${path.delimiter}${env[pathKey]}`;

const run = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', env, ...opts });

if (!fs.existsSync('android/keystore.properties')) {
  console.error('缺少 android/keystore.properties（签名配置），无法打正式版。备份位置见 README 的「签名密钥」一节。');
  process.exit(1);
}
{
  // 密钥文件丢了就提前报错，别等 Gradle 跑到一半才失败
  const props = Object.fromEntries(
    fs
      .readFileSync('android/keystore.properties', 'utf8')
      .split(/\r?\n/)
      .filter((l) => l.includes('='))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
  );
  if (!props.storeFile || !fs.existsSync(props.storeFile)) {
    console.error(`签名密钥不存在：${props.storeFile}`);
    console.error('没有原始密钥就无法发布能覆盖安装的新版本，只能重新生成并让用户卸载重装。');
    process.exit(1);
  }
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
