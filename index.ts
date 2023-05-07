import { parse } from '@skitscript/parser-nodejs'
import { map } from '@skitscript/mapper-nodejs'
import type { FileSystem, MapCharacter, MapState, MapStateCharacter, Path, WebBackground, WebCharacter, WebData, WebState } from '@skitscript/types-nodejs'
import { type compileTemplate, compile as compilePug } from 'pug'
import { compileString } from 'sass'
import { join } from 'path'
import { minifyHtml } from './minify-html'
import { minifySvg } from './minify-svg'
import { separateAttributesAndContentOfSvg } from './separate-attributes-and-content-of-svg'
import { convertRunsToHtml } from './convert-runs-to-html'
import { transpileMap } from './transpile-map'

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
  let data: null | Omit<WebData, 'css'>
  let sassLines: null | readonly string[] = null
  let svgPaths: null | readonly Path[] = null
  let pugTemplate: null | compileTemplate = null
  let sass: null | string = null
  let css: null | string = null

  interface Svg {
    readonly path: Path
    readonly attributes: Record<string, string>
    readonly content: string
  }

  const svgs: Svg[] = []

  const getSvgByPath = (path: Path): Svg => {
    const output = svgs.find(svg => svg.path.length === path.length && svg.path.every((item, index) => path[index] === item))

    if (output === undefined) {
      throw new Error(`Unable to find SVG "${join(...path)}".`)
    }

    return output
  }

  const output = {
    async recompile (changes: readonly Path[]): Promise<void> {
      const skitscriptChanged = changes.some(path => path.length === 1 && path[0] === 'index.skitscript')
      const pugTemplateChanged = changes.some(path => path.length === 1 && path[0] === 'index.pug')
      const sassChanged = changes.some(path => path.length === 1 && path[0] === 'index.sass')

      if (skitscriptChanged) {
        data = null
        css = null
        sassLines = null
        svgPaths = null
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

      const anySvgsChanged = false

      const loadSass = async (): Promise<void> => {
        sass = await fileSystem.readUtf8EncodedTextFile(['index.sass'])
      }

      const generateCss = (): void => {
        css = compileString([sass as string, ...(sassLines as readonly string[])].join('\n'), { syntax: 'indented' }).css
        // TODO: minify
      }

      const loadSvgs = async (): Promise<void> => {
        // const changedSvgPaths = svgs.filter(svg => !svgs.some(svg => svg.path.length === svgPath.length && svg.path.every((item, index) => svgPath[index] === item)))

        // anySvgsChanged = changedSvgPaths.length > 0

        // await Promise.all(changedSvgPaths.map(async svg => {
        //   const text = await fileSystem.readUtf8EncodedTextFile(svg)
        //   const optimized = minifySvg(text)
        //   svgs.push({ path: svg, ...separateAttributesAndContentOfSvg(optimized) })
        // }))
        // TODO
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
                    {
                      const transpiled = transpileMap(ourMap)

                      data = transpiled.data
                      sassLines = transpiled.sassLines
                      svgPaths = transpiled.svgPaths
                    }
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
        const html = (pugTemplate as compileTemplate)({ css, ...data })
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
