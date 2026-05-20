/**
 * preload.js — Electron Preload Script
 *
 * Runs in an isolated context BEFORE the renderer (index.html) loads.
 * Exposes a strictly-typed, minimal API on window.ipcRenderer so the
 * renderer can communicate with the main process WITHOUT nodeIntegration.
 *
 * Security notes:
 *  - contextIsolation: true  → renderer cannot reach Node/Electron directly
 *  - sandbox: true           → renderer process is OS-sandboxed
 *  - Only explicitly listed channels are exposed (allowlist pattern)
 */

const { contextBridge, ipcRenderer } = require('electron');

// Channels the renderer is allowed to LISTEN to (main → renderer)
const VALID_RECEIVE_CHANNELS = ['update-available', 'update-downloaded'];

// Channels the renderer is allowed to INVOKE (renderer → main, returns Promise)
const VALID_INVOKE_CHANNELS = ['check-for-updates', 'install-update'];

contextBridge.exposeInMainWorld('ipcRenderer', {
  /**
   * Subscribe to a main-process event.
   * @param {string} channel
   * @param {Function} listener  - called with (...args) when event fires
   * @returns {Function} unsubscribe — call to remove the listener
   */
  on(channel, listener) {
    if (!VALID_RECEIVE_CHANNELS.includes(channel)) {
      console.warn(`[preload] Blocked receive on unknown channel: "${channel}"`);
      return () => {};
    }
    // Wrap so we never expose the raw ipcRenderer event object
    const wrapped = (_event, ...args) => listener(...args);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },

  /**
   * Send a two-way message to the main process (returns a Promise).
   * @param {string} channel
   * @returns {Promise<any>}
   */
  invoke(channel) {
    if (!VALID_INVOKE_CHANNELS.includes(channel)) {
      return Promise.reject(new Error(`[preload] Blocked invoke on unknown channel: "${channel}"`));
    }
    return ipcRenderer.invoke(channel);
  },
});