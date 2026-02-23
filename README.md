## Iconfont plugins for vite and tailwindcss

### Features

- Multi-Font Support: Out-of-the-box support for Material Symbols Outline, FontAwesome, and Lucide.

- Custom Icon Fonts: Compatible with most custom icon fonts via CSS URLs (referencing woff2) or direct woff2 links.

- Automatic Mapping: Automatically parses ligatures and symbol names to generate `.icon-<name>` CSS classes.

- Tailwind Integration:
  + Provides dynamic `icon-[*]` theme utilities.

  + Full support for the VS Code Tailwind CSS IntelliSense linter.

  + Auto-populates detected icon names for better DX.

- Vite Build Optimization:

  + Tree-shaking for Fonts: Automatically generates a "stripped" version of the icon font containing only the symbols used in your project.

  + CSS Embedding: Embeds the optimized font directly into your production CSS bundle to eliminate extra network requests and prevent "flash of unstyled text."

### How to use

In `style.css` of your app
```css
@import "tailwindcss";
@plugin "@radatek/iconfont/tailwind";
/* or */ 
@plugin "@radatek/iconfont/tailwind" ("fontawesome");
```

In `vite.config.js` of your app
```js
import iconfontPlugin form "@radatek/iconfont";

export default defineConfig({
  plugins: [
    tailwindcss(),
    iconfontPlugin(/* "fontawesome" */)
  ],
  ...
})
```

By default uses Material Symbols, and both plugins (vite an tailwind) must match font type.

### Hints

#### VSCode linter
On first start or changing font, VSCode linter may not populate all icons as tailwindcss plugins are synchronous and downloading fonts takes some time

#### Cache

Cache files (downloaded and generated) are stored in `node_modules/.cache/iconfont` and automatically reloads after 7 days