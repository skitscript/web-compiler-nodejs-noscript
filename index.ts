import { parse } from '@skitscript/parser-nodejs'
import { map } from '@skitscript/mapper-nodejs'
import type { FileSystem, Path, WebBackground, WebCharacter, WebData, WebEmote, WebImage } from '@skitscript/types-nodejs'
import { type compileTemplate, compile as compilePug } from 'pug'
import { compileString } from 'sass'
import { join } from 'path'
import { minifyHtml } from './minifyHtml'
import { transpileMap } from './transpile-map'
import { type Data } from './Data'
import { minifySvg } from './minifySvg'
import { separateAttributesAndContentOfSvg } from './separate-attributes-and-content-of-svg'
import { type Image } from './Image'

/**
 * Compiles a SkitScript document once.
 * @param fileSystem The filesystem to use.  Source files will be read from this, then build artifacts will be written back to it.
 * @returns An object which can be used to run additional build(s).
 */
export const compile = async (fileSystem: FileSystem): Promise<{
  /**
   * Runs an additional build.
   * @param changes The path(s) to the file(s) which were deleted or changed.
   */
  readonly recompile: (changes: readonly Path[]) => Promise<void>
}> => {
  let data: null | Data
  let pugTemplate: null | compileTemplate = null
  let sass: null | string = null
  let css: null | string = null

  interface Svg {
    readonly path: Path
    readonly attributes: Record<string, string>
    readonly content: string
  }

  const svgs: Svg[] = []

  const convertImage = (image: Image): WebImage => {
    const svg = svgs.find(svg => svg.path.length === image.path.length && svg.path.every((item, index) => image.path[index] === item))

    if (svg === undefined) {
      throw new Error(`Unable to find SVG "${join(...image.path)}".`)
    }

    return {
      tagName: 'svg',
      attributes: { ...image.element.attributes, ...svg.attributes },
      content: { html: svg.content }
    }
  }

  const output = {
    async recompile (changes: readonly Path[]): Promise<void> {
      const skitscriptChanged = changes.some(path => path.length === 1 && path[0] === 'index.skitscript')
      const pugTemplateChanged = changes.some(path => path.length === 1 && path[0] === 'index.pug')
      const sassChanged = changes.some(path => path.length === 1 && path[0] === 'index.sass')

      if (skitscriptChanged) {
        data = null
        css = null
      }

      if (pugTemplateChanged) {
        pugTemplate = null
      }

      if (sassChanged) {
        sass = null
        css = null
      }

      for (let i = 0; i < svgs.length;) {
        const svg = svgs[i] as Svg

        if (changes.some(path => path.length === svg.path.length && path.every((item, index) => svg.path[index] === item))) {
          svgs.splice(i, 1)
        } else {
          i++
        }
      }

      const initialPromises: Array<Promise<void>> = []

      let anySvgsChanged = false

      const loadSass = async (): Promise<void> => {
        sass = await fileSystem.readUtf8EncodedTextFile(['index.sass'])
      }

      const generateCss = (): void => {
        css = compileString(`${sass as string}\n${(data as Data).sass}`, { syntax: 'indented' }).css
        // TODO: minify
      }

      const loadSvgs = async (): Promise<void> => {
        const absoluteData = data as Data

        for (let svgIndex = 0; svgIndex < svgs.length;) {
          const svg = svgs[svgIndex] as Svg

          if (absoluteData.svgPaths.some(svgPath => svgPath.length === svg.path.length && svgPath.every((item, itemIndex) => item === svg.path[itemIndex]))) {
            svgIndex++
          } else {
            svgs.splice(svgIndex, 1)
          }
        }

        const svgPathsToLoad = absoluteData.svgPaths.filter(svgPath => !svgs.some(svg => svg.path.length === svgPath.length && svg.path.every((item, itemIndex) => item === svgPath[itemIndex])))

        anySvgsChanged = svgPathsToLoad.length > 0

        await Promise.all(svgPathsToLoad.map(async svgPath => {
          const text = await fileSystem.readUtf8EncodedTextFile(svgPath)
          const optimized = minifySvg(text)
          svgs.push({ path: svgPath, ...separateAttributesAndContentOfSvg(optimized) })
        }))
      }

      if (skitscriptChanged) {
        initialPromises.push((async () => {
          const skitscriptPromises: Array<Promise<void>> = [
            (async () => {
              const text = await fileSystem.readUtf8EncodedTextFile(['index.skitscript'])
              const parsed = parse(text)

              switch (parsed.type) {
                case 'invalid':
                  throw new Error('TODO')

                case 'valid': {
                  const ourMap = map(parsed)

                  switch (ourMap.type) {
                    case 'invalid':
                      throw new Error('TODO')

                    case 'valid':
                      data = transpileMap(ourMap)
                  }
                }
              }
            })()
          ]

          if (sassChanged) {
            skitscriptPromises.push(loadSass())
          }

          await Promise.all(skitscriptPromises)

          generateCss()
          await loadSvgs()
        })())
      } else {
        initialPromises.push(loadSvgs())

        if (sassChanged) {
          initialPromises.push((async () => {
            await loadSass()
            generateCss()
          })())
        }
      }

      if (pugTemplateChanged) {
        initialPromises.push((async () => {
          const text = await fileSystem.readUtf8EncodedTextFile(['index.pug'])
          pugTemplate = compilePug(text)
        })())
      }

      await Promise.all(initialPromises)

      if (skitscriptChanged || pugTemplateChanged || sassChanged || anySvgsChanged) {
        const absoluteData = data as Data

        const converted: WebData = {
          css: css as string,
          javascript: '',
          states: absoluteData.data.states,
          characters: absoluteData.data.characters.map((character): WebCharacter => ({
            normalized: character.normalized,
            element: {
              tagName: 'div',
              attributes: {}, // TODO
              content: {
                emotes: character.element.content.emotes.map((emote): WebEmote => ({
                  normalized: emote.normalized,
                  element: convertImage(emote)
                }))
              }
            }
          })),
          backgrounds: absoluteData.data.backgrounds.map((background): WebBackground => ({
            normalized: background.normalized,
            element: convertImage(background)
          }))
        }

        const html = (pugTemplate as compileTemplate)(converted)
        await fileSystem.writeUtf8EncodedTextFile(['index.html'], minifyHtml(html))
      }
    }
  }

  await output.recompile([
    ['index.skitscript'],
    ['index.pug'],
    ['index.sass']
  ])

  return output
}
