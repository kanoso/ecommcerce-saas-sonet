#!/usr/bin/env node
// Applies two patches needed for the EAS Android build:
//
// 1. Gradle wrapper URL: replaces services.gradle.org with a CDN mirror
//    to avoid the 10s download timeout that EAS build workers hit.
//
// 2. expo-modules-core build.gradle: uses findByName() instead of getByName()
//    for react-native-worklets tasks. worklets 0.8.x uses Prefab and does not
//    produce mergeDebugNativeLibs/mergeReleaseNativeLibs tasks, so getByName()
//    throws. findByName() returns null gracefully and we skip when not found.

const fs = require('fs');
const path = require('path');

function patch(filePath, description, fn) {
  if (!fs.existsSync(filePath)) {
    console.log(`[patch] SKIP — ${filePath} not found`);
    return;
  }
  const original = fs.readFileSync(filePath, 'utf8');
  const result = fn(original);
  if (result === original) {
    console.log(`[patch] SKIP — ${description} already applied or pattern changed`);
    return;
  }
  fs.writeFileSync(filePath, result, 'utf8');
  console.log(`[patch] OK   — ${description}`);
}

// --- 1. Gradle wrapper CDN mirror ---
patch(
  path.join('android', 'gradle', 'wrapper', 'gradle-wrapper.properties'),
  'Gradle wrapper URL → CDN mirror',
  (content) =>
    content.replace(
      /services\.gradle\.org\/distributions/g,
      'downloads.gradle-dn.com/distributions'
    )
);

// --- 2. expo-modules-core worklets task lookup ---
patch(
  path.join('node_modules', 'expo-modules-core', 'android', 'build.gradle'),
  'expo-modules-core: getByName → findByName for worklets tasks',
  (content) => {
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
      println("Linking react-native-worklets mergeDebugNativeLibs into expo-modules-core")
      tasks.findByName("buildCMakeDebug")?.dependsOn(mergeDebug)
    }
    if (mergeRelease != null) {
      println("Linking react-native-worklets mergeReleaseNativeLibs into expo-modules-core")
      tasks.findByName("buildCMakeRelWithDebInfo")?.dependsOn(mergeRelease)
    }
  }`;

    return content.replace(OLD, NEW);
  }
);
