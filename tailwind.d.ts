/** Iconfont plugin for tailwind. Provides .icon, .icon.filled, icon-* utilities. */
declare function iconFontPlugin(options?: { type?: 'materialsymbols' | 'lucide' | 'fontawesome' | `https://${string}` }): import('tailwindcss/plugin').PluginWithConfig;

export default iconFontPlugin;
