#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"

export JAVA_HOME
export ANDROID_HOME
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"
export JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS:--Djava.net.preferIPv4Stack=true}"
export GRADLE_OPTS="${GRADLE_OPTS:-} -Dorg.gradle.internal.http.connectionTimeout=120000 -Dorg.gradle.internal.http.socketTimeout=120000"
export NODE_ENV="${NODE_ENV:-production}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

if [[ ! -x "$JAVA_HOME/bin/java" ]]; then
  echo "Java 17 was not found at $JAVA_HOME" >&2
  exit 1
fi

if [[ ! -d "$ANDROID_HOME/platforms/android-36" ]]; then
  echo "Android SDK 36 was not found under $ANDROID_HOME" >&2
  exit 1
fi

cd "$ROOT_DIR"
npx expo prebuild --platform android --no-install
./android/gradlew -p android assembleRelease

mkdir -p artifacts
cp android/app/build/outputs/apk/release/app-release.apk artifacts/Marden-1.0.0.apk
shasum -a 256 artifacts/Marden-1.0.0.apk
