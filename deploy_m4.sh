#!/bin/bash
set -e

echo "=== M4 Deployment: Deploying NetLib to /home/sonu/netlib ==="
TARGET_DIR="/home/sonu/netlib"
SOURCE_DIR="/run/media/sonu/hdd exfat/projectssss/Net Lib/netlib"

mkdir -p "$TARGET_DIR"

echo "Syncing files to $TARGET_DIR..."
# Copy all files from SOURCE_DIR to TARGET_DIR
cp -a "$SOURCE_DIR/." "$TARGET_DIR/"

# Remove existing build cache in target if any to verify clean build
rm -rf "$TARGET_DIR/.next"

echo "Verifying clean build in $TARGET_DIR..."
cd "$TARGET_DIR"
npm run build

echo "Running full test suite in $TARGET_DIR..."
npm test

echo "=== M4 Deployment Verification Succeeded! ==="
