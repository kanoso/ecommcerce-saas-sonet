const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Patch 1: Redirect Gradle wrapper download to CDN mirror to avoid the
// 10-second timeout that hits services.gradle.org on EAS build workers.
const withGradleCdnMirror = (config) =>
  withDangerousMod(config, [
    'android',
    (config) => {
      const wrapperProps = path.join(
        config.modRequest.platformProjectRoot,
        'gradle',
        'wrapper',
        'gradle-wrapper.properties'
      );
      if (fs.existsSync(wrapperProps)) {
        const patched = fs.readFileSync(wrapperProps, 'utf8').replace(
          /services\.gradle\.org\/distributions/g,
          'downloads.gradle-dn.com/distributions'
        );
        fs.writeFileSync(wrapperProps, patched, 'utf8');
        console.log('[app.plugin] Gradle wrapper URL → CDN mirror');
      }
      return config;
    },
  ]);

// Patch 2: expo-modules-core build.gradle uses getByName() for worklets tasks,
// which throws when react-native-worklets 0.8.x uses Prefab and does not produce
// mergeDebugNativeLibs/mergeReleaseNativeLibs. Switch to findByName() with null
// checks so the build continues gracefully when those tasks are absent.
const withWorkletsTaskFix = (config) =>
  withDangerousMod(config, [
    'android',
    (config) => {
      const buildGradle = path.join(
        config.modRequest.projectRoot,
        'node_modules',
        'expo-modules-core',
        'android',
        'build.gradle'
      );
      if (!fs.existsSync(buildGradle)) return config;

      const OLD = `  afterEvaluate {
    println("Linking react-native-worklets native libs into expo-modules-core build tasks")
    println(workletsProject.tasks.getByName("mergeDebugNativeLibs"))
    println(workletsProject.tasks.getByName("mergeReleaseNativeLibs"))
    tasks.getByName("buildCMakeDebug").dependsOn(workletsProject.tasks.getByName("mergeDebugNativeLibs"))
    tasks.getByName("buildCMakeRelWithDebInfo").dependsOn(workletsProject.tasks.getByName("mergeReleaseNativeLibs"))
  }`;

      const NEW = `  afterEvaluate {
    def mergeDebug = workletsProject.tasks.findByName("mergeDebugNativeLibs")
    def mergeRelease = workletsProject.tasks.findByName("mergeReleaseNativeLibs")
    if (mergeDebug != null) {
      println("Linking worklets mergeDebugNativeLibs into expo-modules-core")
      tasks.findByName("buildCMakeDebug")?.dependsOn(mergeDebug)
    }
    if (mergeRelease != null) {
      println("Linking worklets mergeReleaseNativeLibs into expo-modules-core")
      tasks.findByName("buildCMakeRelWithDebInfo")?.dependsOn(mergeRelease)
    }
  }`;

      const original = fs.readFileSync(buildGradle, 'utf8');
      if (original.includes(OLD)) {
        fs.writeFileSync(buildGradle, original.replace(OLD, NEW), 'utf8');
        console.log('[app.plugin] expo-modules-core build.gradle: getByName → findByName for worklets tasks');
      }
      return config;
    },
  ]);

module.exports = (config) => {
  config = withGradleCdnMirror(config);
  config = withWorkletsTaskFix(config);
  return config;
};
