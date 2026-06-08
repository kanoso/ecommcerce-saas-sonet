#!/usr/bin/env node
// Patches expo-modules-core build.gradle to use findByName() instead of getByName()
// for react-native-worklets tasks. Worklets 0.8.x uses Prefab and does not produce
// mergeDebugNativeLibs/mergeReleaseNativeLibs tasks, so getByName() throws.
// findByName() returns null gracefully and we skip the dependency when not found.

const fs = require('fs');
const path = require('path');

const target = path.join('node_modules', 'expo-modules-core', 'android', 'build.gradle');

if (!fs.existsSync(target)) {
  console.log(`[patch] ${target} not found — skipping`);
  process.exit(0);
}

let content = fs.readFileSync(target, 'utf8');

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

if (!content.includes(OLD)) {
  console.log('[patch] expo-modules-core build.gradle already patched or format changed — skipping');
  process.exit(0);
}

content = content.replace(OLD, NEW);
fs.writeFileSync(target, content, 'utf8');
console.log('[patch] expo-modules-core build.gradle patched successfully');
