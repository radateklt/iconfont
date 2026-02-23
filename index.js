import fs from 'fs/promises'
import { readFileSync } from 'fs'
import * as fontkit from 'fontkit'
import svg2ttf from '@pixi/svg2ttf'
import wawoff2 from 'wawoff2'
import path from 'path'
import crypto from 'crypto'

const defaultUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36'
const emptyFont = 'data:font/woff2;base64,d09GMgABAAAAAALoAA0AAAAABmQAAAKRAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP0ZGVE0cGh4GYACCQggCYAkgCxYIBBcOBAQgBYR9B4M9G70I6wY2ZjbO7S8K6mqaat9NDALxw9uP77u973tL6pIsm7ZpG5S6IGvKEmAtE6N0KCWpC1WjT/UFrv9/fL9/v9/f79/v9/f79/v9/f79/n8A/0H/r/+p/3807P8fF3Mv+pP+pD9mGv2WfWkY6A6/Tf6vA8T/I3F0I8X69U6mN9U9vQ4QeL6vI98f+Y5P677mO3vVn706f9H/K9/u9X0LwP9P9C9C4j+P6T6F+f/59/8D/M8EAA=='

class SVGGlyph {
  constructor(name, code, ligature, width, svg) {
    this.name = name
    this.code = code
    this.ligature = ligature
    this.svg = svg
    this.width = width || 0
  }

  toString(ligature = false) {
    const res = [this.code === 0 ? '<missing-glyph' : '<glyph']
    if (!ligature && this.code === undefined)
      return ''
    if (ligature && !this.name && !this.ligature)
      return ''
    if (this.name)
      res.push('glyph-name="' + this.name.replace(/[^a-zA-Z0-9._-]/g, c => '_') + '"')
    if (this.code !== 0) {
      let unicode = ligature ?
        (this.ligature || this.name) : String.fromCodePoint(this.code || 0)
      if (unicode.length === 1)
        unicode = '&#x' + unicode.charCodeAt(0).toString(16) + ';'
      else
        unicode = unicode.replace(/^\d|[^a-zA-Z0-9._-]/g, c => '&#x' + c.charCodeAt(0).toString(16) + ';')
      res.push('unicode="' + unicode + '"')
    }
    if (this.width)
      res.push('horiz-adv-x="' + this.width + '"')
    res.push('d="' + (this.svg || '') + '"')
    res.push('/>')
    return res.join(' ')
  }
}

export class IconFont {
  constructor(iconsType, cacheDir) {
    switch (iconsType) {
      case undefined:
      case 'materialsymbols':
      case 'material-symbols':
      case 'materialicons':
      case 'material-icons':
        this.iconsType = 'materialsymbols'
        this.fontUrl = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@400,0..1'
        break
      case 'lucide-static':
      case 'lucide':
        this.iconsType = 'lucide'
        this.fontUrl = 'https://unpkg.com/lucide-static/font/lucide.css'
        break
      case 'fontawesome':
        this.iconsType = 'fontawesome'
        // TODO: support multiple font files
        this.fontUrl = 'https://unpkg.com/@fortawesome/fontawesome-free/css/all.css'
        break
      default:
        if (!iconsType.startsWith('https://'))
          throw new Error('Invalid icons font type: ' + iconsType)
        this.iconsType = 'custom'
        this.fontUrl = iconsType
    }
    this.cacheDir = cacheDir || path.join(process.cwd(), 'node_modules', '.cache', 'iconfont')
    this.fontPath = ''

    this.id = 'iconfont'
    this.family = 'Icon Font'
    this.glyphs = []
    this.glyphsCode = []
    this.ligatures = {}
    this.names = {}
  }

  loadSync () {
    if (!this.fontPath) {
      let config
      try {
        config = JSON.parse(readFileSync(path.join(this.cacheDir, this.iconsType + '.json'), 'utf-8'))
      } catch {
        console.error('Cannot read ' + path.join(this.cacheDir, this.iconsType + '.json')) 
      }
      if (!config) {
        this.load().catch((e => console.error(e.message)))
      } else {
        this.fontPath = config.fontPath
        this.id = config.id
        this.family = config.family
        this.glyphs = config.glyphs
        this.glyphsCode = config.glyphsCode
        this.ligatures = config.ligatures
        this.names = config.names
      }
    }
  }

  async load() {
    if (!this.fontPath) {
      let config
      try {
        config = JSON.parse(await fs.readFile(join(this.cacheDir, this.iconsType + 'json'), 'utf-8'))
      } catch {
      }
      if (config && (config.time < Date.now() - 7 * 24 * 60 * 60 * 1000 ||
        config.fontUrl !== this.fontUrl || !await fs.stat(config.fontPath).catch(() => {})))
        config = undefined
      if (!config) {
        await this.loadFromUrl(this.fontUrl)
        config = {
          time: Date.now(),
          fontPath: this.fontPath,
          fontUrl: this.fontUrl,
          id: this.id,
          family: this.family,
          glyphs: this.glyphs,
          glyphsCode: this.glyphsCode,
          ligatures: this.ligatures,
          names: this.names
        }
        await Promise.all((await fs.readdir(this.cacheDir)).filter(f => f.endsWith('.woff2') && f.startsWith(this.iconsType + '-')).map(f => fs.unlink(path.join(this.cacheDir, f)))).catch(() => {})
        await fs.writeFile(path.join(this.cacheDir, this.iconsType + '.json'), JSON.stringify(config, null, 2))
      }

      this.fontPath = config.fontPath
      this.id = config.id
      this.family = config.family
      this.glyphs = config.glyphs
      this.glyphsCode = config.glyphsCode
      this.ligatures = config.ligatures
      this.names = config.names
    }
  }

  getGlyphNames() {
    const names = {}
    for (const id in this.ligatures)
      names[id] = id
    for (const id in this.names) {
      const code = this.glyphsCode[this.names[id]]
      if (code)
        names[id] = String.fromCodePoint(code)
    }
    return names
  }

  async getFontPath() {
    await this.load()
    return this.fontPath
  }

  async generateCSS(glyphs) {
    const css = []
    const add = s => css.push(s)
    add(`@font-face {
  font-family: "iconfont";
  font-style: normal;
  font-weight: 400;
  src: url(iconfont.woff2) format("woff2");
}`)
    add(`.icon {
  font-family: "iconfont";
  font-weight: normal;
  font-style: normal;
  max-width: 2em;
  width: 1.25em;
  text-align: center;
  overflow: hidden;
  letter-spacing: normal;
  text-transform: none;
  display: inline-block;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;
  line-height: 1;
  font-feature-settings: "liga";
  vertical-align: middle;
  font-display: block;
}
.icon.filled {
  font-variation-settings: 'FILL' 1;
}
.icon {
  font-size: 1.25em;
  vertical-align: middle;
}
.icon::before {
  content: var(--icon-content);
  vertical-align: middle;
}`)

    if (typeof glyphs === 'string')
      glyphs = glyphs.split(',')
    if (!glyphs)
      glyphs = Object.keys(this.names)

    for (const name of glyphs) {
      const id = this.names[name] || this.ligatures[name]
      let content = this.glyphsCode[id]
      if (content) content = '\\' + ('000' + content.toString(16)).slice(-4)
      if (!content && this.ligatures[name])
        content = name
      if (content)
        add(`.icon-${name.replace(/[^a-zA-Z0-9_-]/g, c => '_')} { --icon-content: "${content}" }`)
    }
    if (glyphs) {
      const buffer = await this.generateFont(glyphs, 'woff2')
      const idx = css[0].indexOf('iconfont.woff2')
      css[0] = css[0].slice(0, idx) +
        emptyFont.slice(0, emptyFont.indexOf(',') + 1) +
        buffer.toString('base64') +
        css[0].slice(idx + 'iconfont.woff2'.length)
    }
    return css.join('\n')
  }

  async loadFromUrl(url, full = false) {
    if (!url.startsWith('https://'))
      throw new Error('Invalid font URL: ' + url)

    await fs.mkdir(this.cacheDir, { recursive: true })

    const headers = { 'User-Agent': defaultUserAgent }
    let res = await fetch(url, { headers })
    let contentType = (res.headers.get('Content-Type')||'').split(';')[0]

    if (res.ok && contentType === 'text/css') {
      const cssTextcss = await res.text()
      const urlMatch = cssTextcss.match(/src:\s*url\((.+?)\)\s*format\('woff2'\)/)
      if (!urlMatch)
        throw new Error('Invalid font URL: ' + url)

      function resolveUrl(url, baseUrl) {
        if (url.startsWith('http://') || url.startsWith('https://'))
          return url      
        if (url.startsWith('//'))
          return `https:${url}`
        
        try {
          const base = new URL(baseUrl)
          const origin = base.origin
          if (url.startsWith('/'))
            return `${origin}${url}`
            
          const basePath = base.pathname.substring(0, base.pathname.lastIndexOf('/') + 1)
          return `${origin}${basePath}${url}`
        } catch {
          throw new Error(`Failed to resolve URL`)
        }
      }

      url = resolveUrl(urlMatch[1], url)
      for (let i = 2; ; i--) {
        res = await fetch(url, { headers })
        if (res.ok || res.status !== 400 || !i)
          break
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      contentType = (res.headers.get('Content-Type')||'').split(';')[0]
      if (!res.ok || (contentType !== 'font/woff2' && contentType !== 'application/font-woff2'))
        throw new Error('Failed to load font from URL: ' + url)
    
      for (let i = 2; ; i--) {
        res = await fetch(url, { headers })
        if (res.ok || res.status !== 400 || !i)
          break
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      contentType = (res.headers.get('Content-Type')||'').split(';')[0]
    }

    if (res.ok && (contentType === 'application/font-woff2' || contentType === 'font/woff2')) {
      const buffer = await res.arrayBuffer()
      this.fontPath = path.join(this.cacheDir, this.iconsType + '.woff2')
      await fs.writeFile(this.fontPath, Buffer.from(buffer))
      return this.loadFromFile(this.fontPath, full)
    }

    throw new Error('Failed to load font from URL: ' + url)
  }

  async loadFromFile(fontPath, full = true) {
    const buffer = fontPath instanceof Buffer ? fontPath : await fs.readFile(path.isAbsolute(fontPath) ? fontPath : path.resolve(process.cwd(), fontPath))
    const font = fontkit.create(await wawoff2.decompress(buffer))

    let minCodePoint = 32
    let maxCodePoint = 32

    const getLigatures = () => {
      const ligatures = {}
      font.GSUB.lookupList.toArray().forEach(entry => {      
        entry.subTables.filter(t => t.lookupType === 4).forEach(subTable => {
          const leadingCharacters = []
          subTable.extension.coverage.rangeRecords.forEach(coverage => {
            for (let i = coverage.start; i <= coverage.end; i++) {
              let character = font.stringsForGlyph(i)[0];
              leadingCharacters.push(character)
            }
          })
          const ligatureSets = subTable.extension.ligatureSets.toArray()
          ligatureSets.forEach((ligatureSet, ligatureSetIndex) => {
            const leadingCharacter = leadingCharacters[ligatureSetIndex]

            ligatureSet.forEach(ligature => {
              const character = font.stringsForGlyph(ligature.glyph)[0]
              if (character) {
                const ligatureText = leadingCharacter + ligature.components.map(x => font.stringsForGlyph(x)[0]).join('')
                ligatures[ligatureText.toLowerCase()] = ligature.glyph
              }
            })
          })
        })
      })
      return ligatures
    }

    this.ligatures = getLigatures()

    if (full) {
      const undefGlyph = font.getGlyph(0)
      this.glyphs[0] = new SVGGlyph(undefGlyph.name, 0, '', undefGlyph.advanceWidth, undefGlyph.path.toSVG())
    }
    for (let x = 1, c = 0; x < font.numGlyphs; x++) {
      const glyph = font.getGlyph(x)
      const character = font.stringsForGlyph(x)[0]
      let code = character ? character.charCodeAt(0) : --c
      if (code > 0 && code < minCodePoint)
        minCodePoint = code
      if (code > 0 && code > maxCodePoint)
        maxCodePoint = code
      const name = code > 0 && code < 127 ? String.fromCharCode(code) : glyph.name?.replace(/^_/, '') || 'uni' + '0000'.slice(0, 4 - code.toString(16).length) + code.toString(16)
      this.names[name] = x
      if (code > 0)
        this.glyphsCode[x] = code
      if (full)
        this.glyphs[x] = new SVGGlyph(glyph.name || name, code, name.length === 1 ? '' : name, glyph.advanceWidth, glyph.path.toSVG())
    }
    if (maxCodePoint < 0xF800)
      maxCodePoint = 0xF800
    maxCodePoint = this.glyphs.reduce((maxCode, glyph) => (glyph.code = glyph.code < 0 ? maxCodePoint - glyph.code > 0xFFFF ? undefined : (maxCodePoint - glyph.code) : glyph.code, maxCode < glyph.code ? glyph.code : maxCode), maxCodePoint)

    this.copyright = font.copyright
    this.id = font.postscriptName
    this.fullName = font.fullName
    this.family = font.familyName
    this.license = font.license
    this.version = font.version
    this.description = font.description || font.fullName
    this.url = font.url
    this.weight = font['OS/2'].usWeightClass
    this.unitsPerEm = font.unitsPerEm
    this.panose = font['OS/2'].panose ? font['OS/2'].panose : [0,0,0,0,0,0,0,0,0,0]
    this.bbox = font.bbox
    this.ascent = font.ascent
    this.descent = font.descent
    this.xHeight = font.xHeight
    this.underlineThickness = font.underlineThickness
    this.underlinePosition = font.underlinePosition
    this.unicodeMin = minCodePoint
    this.unicodeMax = maxCodePoint    
  }

  async generateFont(glyphs, format = 'woff2') {
    if (!this.fontPath)
      await this.load()
    if (this.glyphs.length === 0)
      await this.loadFromFile(this.fontPath, true)

    if (glyphs && typeof glyphs === 'string')
      glyphs = glyphs.split(',')
    if (glyphs)
      glyphs = glyphs.filter(g => g.match(/^[a-zA-Z0-9_-]+$/i) && (this.ligatures[g] || this.names[g]))
    if (glyphs && glyphs.length === 0)
      return Buffer.from(emptyFont.slice(emptyFont.indexOf(',') + 1), 'base64')

    // special case for material design icons
    if (glyphs && this.fontUrl.startsWith('https://fonts.googleapis.com')) {
      const headers = { 'User-Agent': defaultUserAgent }
      const url = this.fontUrl + '&icon_names=' + glyphs.join(',')
      const hash = crypto.createHash('sha256').update(url).digest('hex')
      const cachePath = path.join(this.cacheDir, `${this.iconsType}-${hash}.woff2`)
      if (await fs.stat(cachePath).catch(() => {}))
        return await fs.readFile(cachePath)

      let res = await fetch(url, { headers })
      if (res.ok) {
        const cssTextcss = await res.text()
        const urlMatch = cssTextcss.match(/src:\s*url\((.+?)\)\s*format\('woff2'\)/)
        if (urlMatch) {
          res = await fetch(urlMatch[1], { headers })
          if (res.ok) {
            const buffer = Buffer.from(await res.arrayBuffer())
            await fs.writeFile(cachePath, buffer)
            return buffer
          }
        }
      }
      throw new Error('Error loading font from: ' + this.fontUrl)
    }

    if (!glyphs && format === 'woff2')
      return await fs.readFile(this.fontPath)

    const svgFont = []
    const add = s => svgFont.push(s)
    const attr = (k, v) => v ? `${k}="${v}"` : ''
    const elem = (tag, close, ...attrs) => add(`<${tag} ${attrs.filter(attr => attr[1]).map(attr => `${attr[0]}="${attr[1]}"`).join(' ')}${close ? '/' : ''}>`)
    add('<?xml version="1.0" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">')
    add('<svg xmlns="http://www.w3.org/2000/svg">')
    add(`<metadata>${this.copyright||''}</metadata>`)
    add('<defs>')
    elem('font', 0, ['id', this.id])
    elem('font-face', 1,
      ['font-family', this.familyName],
      ['font-stretch', 'normal'],
      ['units-per-em', this.unitsPerEm],
      ['font-weight', this.weight],
      ['panose-1', this.panose && this.panose.join(' ')],
      ['ascent', this.ascent],
      ['descent', this.descent],
      ['x-height', this.xHeight],
      ['underline-thickness', this.underlineThickness],
      ['underline-position', this.underlinePosition],
      ['unicode-range', this.unicodeMin && this.unicodeMax && 'U+' + ('0000' + this.unicodeMin.toString(16)).slice(-4) + '-' + ('0000' + this.unicodeMax.toString(16)).slice(-4)],
      ['bbox', this.bbox && this.bbox.minX + "," + this.bbox.minY + "," + this.bbox.maxX + "," + this.bbox.maxY]
    )
    add(this.glyphs[0].toString())
    const ids = {}

    if (!glyphs) {
      for (let k = 1; k < this.glyphs.length; k++)
        ids[k] = true
    } else {
      if (typeof glyphs === 'string')
        glyphs = glyphs.split(',')
      for (let k = 0; k < glyphs.length; k++)
        if (this.ligatures[glyphs[k]])
          ids[glyphs[k]] = true
        else if (this.names[glyphs[k]])
          ids[this.names[glyphs[k]]] = true
    }

    Object.keys(ids).sort().forEach(id => add(this.glyphs[k].toString()))

    add('</font>')
    add('</defs>')
    add('</svg>')

    const svg = svgFont.join('\n')
    if (format === 'svg')
      return svg
    const ttf = svg2ttf(svg, this).buffer
    if (format === 'ttf')
      return ttf
    if (format === 'woff2')
      return await wawoff2.compress(ttf)
    throw new Error('Unknown format: ' + format)
  }
}

let globalFont
export function iconfontPlugin(type) {
  if (!type)
    type = 'materialsymbols'
  if (globalFont && globalFont.iconsType !== type)
    console.warn('iconfontPlugin: font type mismatch in plugins: ', type, ' vs ', globalFont.iconsType)
  if (!globalFont || globalFont.iconsType !== type)
    globalFont = new IconFont(type)
  const glyphs = {}

  function findGlyph(code) {
    code.matchAll(/\bicon-\[?([a-zA-Z0-9_-]+)/g).forEach(m => glyphs[m[1]] = true)
  }

  return [
    {
      name: 'iconfont-pre',
      enforce: 'pre',

      async config(config, { command }) {
        await globalFont.load()
      },

      async transform(code, id, opt) {
        if (id.includes('node_modules')) return code
        if (id.endsWith('.css')) {
          let idx = code.indexOf(emptyFont)
          if (idx === -1) {
            idx = code.indexOf('url(iconfont.woff2)')
            if (idx > 0)
              idx += 4
          }
          if (idx > 0) {
            const url = this.environment.mode !== 'build' ? '@fs' + globalFont.fontPath.replace(/\\/g, '/') : emptyFont
            code = code.slice(0, idx) + url + code.slice(code.indexOf(')', idx))
          }
          return code
        }
        if (this.environment.mode !== 'build')
          return code

        findGlyph(code)
        return code
      }
    },
    {
      name: 'iconfont-post',
      apply: 'build',
      enforce: 'post',

      async generateBundle(options, bundle) {
        if (Object.keys(glyphs).length) {
          const fontBuffer = await globalFont.generateFont(Object.keys(glyphs), 'woff2')
          for (const n in bundle) {
            const obj = bundle[n]
            if (n.endsWith('.css')) {
              let idx = obj.source.indexOf('url(iconfont.woff2)')
              if (idx > 0)
                idx += 4
              else
                idx = obj.source.indexOf(emptyFont)
              if (idx > 0) {
                obj.source = obj.source.slice(0, idx) +
                  emptyFont.slice(0, emptyFont.indexOf(',') + 1) +
                  fontBuffer.toString('base64') + 
                  obj.source.slice(obj.source.indexOf(')', idx))
                break
              }
            }
          }
        }
      }
    }
  ]
}

export default iconfontPlugin

const pluginWithOptions = (t) => (t.__isOptionsFunction = !0, t)
export const tailwindPlugin = pluginWithOptions((options) => {
  if (typeof options === 'string')
    options = { type: options }
  if (!globalFont)
    globalFont = new IconFont(options?.type || 'materialsymbols')
  globalFont.loadSync()

  return {
    handler: ({ addBase, addComponents, matchUtilities, theme }) => {
      addBase({
        '@font-face': {
          'font-family': '"iconfont"',
          'font-style': 'normal',
          'font-weight': '400',
          'src': `url(iconfont.woff2) format("woff2")`,
        },
      })
      addComponents({
        '.icon': {
          'font-family': '"iconfont"',
          'font-weight': 'normal',
          'font-style': 'normal',
          'max-width': '2em',
          'width': '1.25em',
          'text-align': 'center',
          'overflow': 'hidden',
          'letter-spacing': 'normal',
          'text-transform': 'none',
          'display': 'inline-block',
          'white-space': 'nowrap',
          'word-wrap': 'normal',
          'direction': 'ltr',
          'line-height': '1',
          'font-feature-settings': '"liga"',
          'vertical-align': 'middle',
          'font-display': 'block',
          'font-size': '1.25em',
          '&::before': {
            'content': 'var(--icon-content)',
            'vertical-align': 'middle',
          },
        },
        '.icon.filled': {
          'font-variation-settings': '"FILL" 1',
        },
      })

      matchUtilities(
        {
          'icon': (value) => ({
            '--icon-content': `"${value}"`,
          }),
        },
        {
          values: theme('icon'),
        }
      )
    },
    config: {
      theme: {
        extend: {
          icon: globalFont.getGlyphNames()
        }
      }      
    }
  }
})