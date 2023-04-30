import { parse } from '@skitscript/parser-nodejs'
import { map } from '@skitscript/mapper-nodejs'
import type { MapState } from '@skitscript/types-nodejs'
import { type compileTemplate, compile as compilePug } from 'pug'
import { minify } from 'html-minifier'
import { optimize } from 'svgo'
import { compileString } from 'sass'
import { XMLBuilder, XMLParser } from 'fast-xml-parser'
import { join } from 'path'
import { escape } from 'html-escaper'

const characterSet = 'abcdefghijklmnopqrstuvwxyz'

const stringifyNumber = (number: number): string => {
  if (number === 0) {
    return 'a'
  }

  let output = ''

  while (number > 0) {
    const remainder = number % characterSet.length

    output = `${characterSet.charAt(remainder)}${output}`

    number -= remainder
    number /= characterSet.length
  }

  return output
}

const xmlSettings = {
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: ''
}

const xmlParser = new XMLParser(xmlSettings)
const xmlBuilder = new XMLBuilder(xmlSettings)

type Path = readonly string[]

interface FileSystem {
  readFile: (path: Path, encoding: 'utf-8') => Promise<string>
  writeFile: ((path: Path, encoding: 'utf-8', data: string) => Promise<void>) & ((path: Path, encoding: null, data: Buffer) => Promise<void>)
}

/**
 *
 * @param fileSystem
 * @returns
 */
export const compile = async (fileSystem: FileSystem): Promise<{
  /**
   *
   * @param changes
   * @returns
   */
  readonly recompile: (changes: readonly Path[]) => Promise<void>
}> => {
  interface State {
    readonly attributes: {
      readonly class: string
      readonly id: string
    }
    readonly content: string
  }

  interface Background {
    readonly normalized: string
    readonly attributes: {
      readonly class: string
      readonly id: string
    }
  }

  interface Mapped {
    readonly states: readonly State[]
    readonly backgrounds: readonly Background[]
    readonly characters: ReadonlyArray<{
      readonly normalized: string
      readonly emotes: ReadonlyArray<{
        readonly normalized: string
        readonly attributes: {
          readonly class: string
          readonly id: string
        }
      }>
    }>
    readonly css: string
  }

  let mapped: null | Mapped = null
  let pugTemplate: null | compileTemplate = null
  let sass: null | string = null
  const svgPaths: Path[] = []

  const addSvgPathIfMissing = (path: Path): void => {
    if (!svgPaths.some(existing => existing.length === path.length && existing.every((item, index) => path[index] === item))) {
      svgPaths.push(path)
    }
  }

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
        mapped = null
        svgPaths.length = 0
      }

      if (pugTemplateChanged) {
        pugTemplate = null
      }

      if (sassChanged) {
        sass = null
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

      const loadSvgs = async (): Promise<void> => {
        const changedSvgPaths = svgPaths.filter(svgPath => !svgs.some(svg => svg.path.length === svgPath.length && svg.path.every((item, index) => svgPath[index] === item)))

        anySvgsChanged = changedSvgPaths.length > 0

        await Promise.all(changedSvgPaths.map(async svg => {
          const text = await fileSystem.readFile(svg, 'utf-8')

          const optimized = optimize(text, {
            multipass: true,
            plugins: [
              'cleanupAttrs',
              'cleanupEnableBackground',
              'cleanupIds',
              {
                name: 'cleanupListOfValues', params: { floatPrecision: 1 }
              },
              { name: 'cleanupNumericValues', params: { floatPrecision: 1 } },
              'collapseGroups',
              'convertColors',
              'convertEllipseToCircle',
              { name: 'convertPathData', params: { floatPrecision: 1 } },
              'convertShapeToPath',
              'convertStyleToAttrs',
              { name: 'convertTransform', params: { floatPrecision: 1 } },
              'inlineStyles',
              { name: 'mergePaths', params: { floatPrecision: 1 } },
              'mergeStyles',
              'minifyStyles',
              'moveElemsAttrsToGroup',
              'moveGroupAttrsToElems',
              'removeComments',
              'removeDesc',
              'removeDoctype',
              'removeEditorsNSData',
              'removeEmptyAttrs',
              'removeEmptyContainers',
              'removeEmptyText',
              'removeHiddenElems',
              'removeMetadata',
              'removeNonInheritableGroupAttrs',
              'removeOffCanvasPaths',
              'removeScriptElement',
              'removeTitle',
              'removeUnknownsAndDefaults',
              'removeUnusedNS',
              'removeUselessDefs',
              'removeUselessStrokeAndFill',
              'removeViewBox',
              'removeXMLNS',
              'removeXMLProcInst',
              'reusePaths'
            ]
          })

          const parsed = xmlParser.parse(optimized.data)
          const attributes = parsed[0][':@']
          const content = xmlBuilder.build(parsed[0].svg)

          svgs.push({ path: svg, attributes, content })
        }))
      }

      if (skitscriptChanged) {
        initialPromises.push((async () => {
          const text = await fileSystem.readFile(['index.skitscript'], 'utf-8')
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
                  let nextClass = 0
                  let nextId = 0

                  const sassLines: string[] = []

                  const stateClass = stringifyNumber(nextClass++)
                  const reorderedStates = [...ourMap.states.slice(1), ourMap.states[0] as MapState]

                  const states: State[] = []

                  for (const state of reorderedStates) {
                    let content = ''

                    // TODO: menu support

                    if (state.line !== null) {
                      // TODO recurse to find shortest version
                      // TODO is there an optimal ordering
                      const stack: Array<'em' | 'strong' | 'code'> = []

                      for (const run of [...state.line, { bold: false, italic: false, code: false, plainText: '' }]) {
                        while (stack.includes('strong') && !run.bold) {
                          content += `</${stack.pop() as string}>`
                        }

                        while (stack.includes('em') && !run.italic) {
                          content += `</${stack.pop() as string}>`
                        }

                        while (stack.includes('code') && !run.code) {
                          content += `</${stack.pop() as string}>`
                        }

                        if (run.bold && !stack.includes('strong')) {
                          content += '<strong>'
                          stack.push('strong')
                        }

                        if (run.italic && !stack.includes('em')) {
                          content += '<em>'
                          stack.push('em')
                        }

                        if (run.code && !stack.includes('code')) {
                          content += '<code>'
                          stack.push('code')
                        }

                        content += escape(run.plainText)
                      }
                    }

                    states.push({
                      attributes: {
                        class: stateClass,
                        id: stringifyNumber(nextId++)
                      },
                      content
                    })
                  }

                  const backgrounds: Background[] = []

                  const backgroundClass = stringifyNumber(nextClass++)

                  for (const state of ourMap.states) {
                    if (state.background !== null) {
                      addSvgPathIfMissing(['backgrounds', `${state.background}.svg`])

                      if (!backgrounds.some(background => background.normalized === state.background)) {
                        backgrounds.push({
                          normalized: state.background,
                          attributes: {
                            class: backgroundClass,
                            id: stringifyNumber(nextId++)
                          }
                        })
                      }
                    }
                  }

                  if (backgrounds.length > 0) {
                    sassLines.push(
                      `.${backgroundClass}`,
                      '  @include background'
                    )
                  }

                  // for (const state of ourMap.states) {
                  //   for (let characterIndex = 0; characterIndex < ourMap.characters.length; characterIndex++) {
                  //     const mappedStateCharacter = state.characters[characterIndex] as MapStateCharacter

                  //     if (mappedStateCharacter.type === 'notPresent') {
                  //       continue
                  //     }

                  //     const character = characters[characterIndex] as Character

                  //     switch (mappedStateCharacter.type) {
                  //       case 'entering':
                  //         if (!Object.prototype.hasOwnProperty.call(character.entryAnimations, mappedStateCharacter.animation)) {
                  //           character.entryAnimations[mappedStateCharacter.animation] = nextClass++
                  //         }
                  //         break

                  //       case 'exiting':
                  //         if (!Object.prototype.hasOwnProperty.call(character.exitAnimations, mappedStateCharacter.animation)) {
                  //           character.exitAnimations[mappedStateCharacter.animation] = nextClass++
                  //         }
                  //         break
                  //     }

                  //     const mappedCharacter = ourMap.characters[characterIndex] as MapCharacter
                  //     const emote = mappedStateCharacter.emote

                  //     addSvgPathIfMissing(['characters', mappedCharacter.normalized, 'emotes', `${emote}.svg`])

                  //     if (!Object.prototype.hasOwnProperty.call(character.exitAnimations, mappedStateCharacter.emote)) {
                  //       character.exitAnimations[mappedStateCharacter.emote] = nextClass++
                  //     }
                  //   }
                  // }

                  for (let index = 0; index < svgs.length;) {
                    const path = (svgs[index] as Svg).path

                    if (svgPaths.some(match => match.length === path.length && match.every((item, itemIndex) => path[itemIndex] === item))) {
                      index++
                    } else {
                      svgPaths.splice(index, 1)
                    }
                  }

                  console.log([sass as string, ...sassLines].join('\n'))

                  // TODO: this needs to move after the sass file is loaded!
                  const css = compileString([sass as string, ...sassLines].join('\n'), { syntax: 'indented' }).css

                  // TODO
                  mapped = {
                    css,
                    states,
                    characters: [],
                    backgrounds
                  }

                  await loadSvgs()
                }
              }
            }
          }
        })())
      } else {
        initialPromises.push(loadSvgs())

        // TODO regen sass if changed
      }

      if (pugTemplateChanged) {
        initialPromises.push((async () => {
          const text = await fileSystem.readFile(['index.pug'], 'utf-8')
          pugTemplate = compilePug(text)
        })())
      }

      if (sassChanged) {
        initialPromises.push((async () => {
          sass = await fileSystem.readFile(['index.sass'], 'utf-8')
        })())
      }

      await Promise.all(initialPromises)

      if (skitscriptChanged || pugTemplateChanged || sassChanged || anySvgsChanged) {
        const absoluteMapped = mapped as Mapped

        const html = (pugTemplate as compileTemplate)({
          css: absoluteMapped.css,
          states: absoluteMapped.states,
          backgrounds: absoluteMapped.backgrounds.map(background => {
            const svg = getSvgByPath(['backgrounds', `${background.normalized}.svg`])

            return {
              attributes: { ...background.attributes, ...svg.attributes },
              content: svg.content
            }
          }),
          characters: []
        })

        const minifiedHtml = minify(html, {
          caseSensitive: false,
          collapseBooleanAttributes: true,
          collapseInlineTagWhitespace: true,
          collapseWhitespace: true,
          conservativeCollapse: false,
          decodeEntities: true,
          html5: true,
          includeAutoGeneratedTags: false,
          keepClosingSlash: false,
          minifyCSS: true,
          minifyJS: false,
          minifyURLs: false,
          preserveLineBreaks: false,
          preventAttributesEscaping: false,
          processConditionalComments: false,
          removeAttributeQuotes: true,
          removeComments: true,
          removeEmptyAttributes: true,
          removeEmptyElements: true,
          removeOptionalTags: true,
          removeRedundantAttributes: true,
          removeScriptTypeAttributes: true,
          removeStyleLinkTypeAttributes: true,
          removeTagWhitespace: true,
          sortAttributes: true,
          sortClassName: true,
          trimCustomFragments: true,
          useShortDoctype: true
        })

        await fileSystem.writeFile(['index.html'], 'utf-8', minifiedHtml)
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
