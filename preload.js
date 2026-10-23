/**
 * preload.js — Electron Preload Script
 *
 * Runs in an isolated context before the page loads. Exposes only the host
 * platform name (used for macOS title-bar spacing); nothing else crosses the
 * context bridge.
 */

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('platform', process.platform);
