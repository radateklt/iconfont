/** Iconfont plugin to download and strip icon fonts */
export function iconfontPlugin(type?: 'materialsymbols' | 'lucide' | 'fontawesome' | `https://${string}`): import('vite').Plugin;

export default iconfontPlugin;

/** Iconfont plugin for tailwind. Provides .icon, .icon.filled, icon-* utilities. */
export function tailwindPlugin(options?: { type?: 'materialsymbols' | 'lucide' | 'fontawesome' | `https://${string}` }): import('tailwindcss/plugin').PluginWithConfig;
