#!/usr/bin/env node
/**
 * Wires release signing into the generated android/app/build.gradle.
 *
 * Run AFTER `pnpm expo prebuild --platform android` (the android/ dir is
 * gitignored and regenerated, so this must be re-applied after every
 * prebuild --clean). Idempotent — exits 0 if already wired.
 *
 * Expects credentials/android/keystore.properties (gitignored) with:
 *   storeFile=/abs/path/to/<app>-release.jks
 *   storePassword=...
 *   keyAlias=...
 *   keyPassword=...
 *
 * Then: cd android && ./gradlew bundleRelease
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const gradlePath = join(appDir, 'android/app/build.gradle');
const propsPath = join(appDir, 'credentials/android/keystore.properties');

if (!existsSync(gradlePath)) {
  console.error(`missing ${gradlePath} — run expo prebuild first`);
  process.exit(1);
}
if (!existsSync(propsPath)) {
  console.error(`missing ${propsPath} — create the upload keystore + properties first`);
  process.exit(1);
}

let g = readFileSync(gradlePath, 'utf8');

const RELEASE_BLOCK = `        release {
            // Upload key lives in gitignored credentials/android/keystore.properties
            def kspFile = rootProject.file('../credentials/android/keystore.properties')
            if (kspFile.exists()) {
                def ksp = new Properties()
                ksp.load(new FileInputStream(kspFile))
                storeFile file(ksp['storeFile'])
                storePassword ksp['storePassword']
                keyAlias ksp['keyAlias']
                keyPassword ksp['keyPassword']
            } else {
                throw new GradleException("Missing credentials/android/keystore.properties for release signing")
            }
        }
`;

if (g.includes('signingConfig signingConfigs.release')) {
  console.log('release signing already wired — nothing to do');
  process.exit(0);
}

// 1) add `release { ... }` to signingConfigs (after the debug block — no nested braces in it)
const dbg = /(signingConfigs\s*{[\s\S]*?debug\s*{[^}]*})/;
if (!dbg.test(g)) {
  console.error('could not locate signingConfigs.debug block — inspect android/app/build.gradle');
  process.exit(1);
}
g = g.replace(dbg, `$1\n${RELEASE_BLOCK}`);

// 2) point buildTypes.release at signingConfigs.release
const bt = /(buildTypes\s*{[\s\S]*?release\s*{[\s\S]*?)signingConfig\s+signingConfigs\.debug/;
if (!bt.test(g)) {
  console.error('could not locate buildTypes.release signingConfig line — inspect android/app/build.gradle');
  process.exit(1);
}
g = g.replace(bt, `$1signingConfig signingConfigs.release`);

writeFileSync(gradlePath, g);
console.log('release signing wired: android/app/build.gradle → credentials/android/keystore.properties');
