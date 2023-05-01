import { parse } from '@skitscript/parser-nodejs'
import { map } from '@skitscript/mapper-nodejs'
import type { MapCharacter, MapState, MapStateCharacter } from '@skitscript/types-nodejs'
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
  // TODO: these types are getting cluttered with intermediate data, they should just be as close as possible to what needs to be passed to Pug and should probably be fully readonly.
  interface State {
    readonly state: MapState
    readonly attributes: {
      class: string
      readonly id: null | string
      readonly href: null | string
    }
    readonly content: string
  }

  interface Background {
    readonly normalized: string
    readonly attributes: {
      readonly class: string
      readonly id: string
    }
    readonly activationClass: null | string
  }

  interface Animation {
    readonly normalized: string
    readonly activationClass: string
  }

  interface Character {
    readonly attributes: {
      readonly id: string
      readonly class: string
    }
    readonly normalized: string
    readonly entryAnimations: Animation[]
    readonly exitAnimations: Animation[]
    readonly emotes: Array<{
      readonly normalized: string
      readonly attributes: {
        readonly class: string
        readonly id: string
      }
      readonly activationClass: string
    }>
    presentClass: null | string
  }

  interface Mapped {
    readonly sassLines: readonly string[]
    readonly states: readonly State[]
    readonly backgrounds: readonly Background[]
    readonly characters: readonly Character[]
  }

  let mapped: null | Mapped = null
  let pugTemplate: null | compileTemplate = null
  let sass: null | string = null
  let css: null | string = null
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
        css = null
        svgPaths.length = 0
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
        sass = await fileSystem.readFile(['index.sass'], 'utf-8')
      }

      const generateCss = (): void => {
        const absoluteMapped = mapped as Mapped
        css = compileString([sass as string, ...absoluteMapped.sassLines].join('\n'), { syntax: 'indented' }).css
        // TODO: minify
      }

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
                name: 'cleanupListOfValues', params: { floatPrecision: 0 }
              },
              { name: 'cleanupNumericValues', params: { floatPrecision: 0 } },
              'collapseGroups',
              'convertColors',
              'convertEllipseToCircle',
              { name: 'convertPathData', params: { floatPrecision: 0 } },
              'convertShapeToPath',
              'convertStyleToAttrs',
              { name: 'convertTransform', params: { floatPrecision: 0 } },
              'inlineStyles',
              { name: 'mergePaths', params: { floatPrecision: 0 } },
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
              'removeDimensions',
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
          const skitscriptPromises: Array<Promise<void>> = [
            (async () => {
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
                      const initialState = ourMap.states[0] as MapState

                      interface ReorderedState {
                        readonly state: MapState
                        readonly id: string
                      }

                      const reorderedStates: readonly ReorderedState[] = [...ourMap.states.slice(1).map(state => ({
                        state,
                        id: stringifyNumber(nextId++)
                      })), { state: initialState, id: stringifyNumber(nextId++) }]

                      const initialReorderedState = reorderedStates[reorderedStates.length - 1] as ReorderedState

                      const states: State[] = []

                      for (const state of reorderedStates) {
                        let content = ''

                        // TODO: menu support

                        if (state.state.line !== null) {
                          // TODO recurse to find shortest version
                          // TODO is there an optimal ordering
                          const stack: Array<'em' | 'strong' | 'code'> = []

                          for (const run of [...state.state.line, { bold: false, italic: false, code: false, plainText: '' }]) {
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
                          state: state.state,
                          attributes: {
                            class: stateClass,
                            id: state.id,
                            href: state.state.interaction.type === 'dismiss'
                              ? state.state.interaction.stateIndex === 0 ? '' : `#${(reorderedStates[state.state.interaction.stateIndex - 1] as ReorderedState).id}`
                              : null
                          },
                          content
                        })
                      }

                      const backgrounds: Background[] = []

                      // TODO: delay this to after adding to states - classes of out sequence
                      const backgroundClass = stringifyNumber(nextClass++)

                      sassLines.push(
                        `.${stateClass}`,
                        '  @include state',
                        '  @include active-state',
                        `.${stateClass}:not(:target):not(#${initialReorderedState.id}), :target ~ #${initialReorderedState.id}`,
                        '  @include inactive-state'
                      )

                      for (const state of states) {
                        if (state.state.background !== null) {
                          addSvgPathIfMissing(['backgrounds', `${state.state.background}.svg`])

                          let background = backgrounds.find(background => background.normalized === state.state.background)

                          if (background === undefined) {
                            background = {
                              normalized: state.state.background,
                              attributes: {
                                class: backgroundClass,
                                id: stringifyNumber(nextId++)
                              },
                              activationClass: state.state === initialState ? null : stringifyNumber(nextClass++)
                            }

                            backgrounds.push(background)
                          }

                          if (background.activationClass !== null && state.state !== initialState) {
                            state.attributes.class += ` ${background.activationClass}`
                          }
                        }
                      }

                      // TODO: microoptimization: one state

                      // TODO: microptimization: one background, always present
                      if (backgrounds.length > 0) {
                        if (initialState.background === null) {
                          sassLines.push(
                            `.${backgroundClass}`,
                            '  @include background',
                            '  @include inactive-background',
                            backgrounds.map(background => `.${background.activationClass as string}:target ~ #${background.attributes.id}`).join(', '),
                            '  @include active-background'
                          )
                        } else {
                          const initialStateBackground = backgrounds.find(background => background.normalized === initialState.background) as Background

                          if (initialStateBackground.activationClass === null) {
                            sassLines.push(
                              `.${backgroundClass}`,
                              '  @include background',
                              `.${backgroundClass}:not(#${initialStateBackground.attributes.id}), :target ~ #${initialStateBackground.attributes.id}`,
                              '  @include inactive-background',
                              `#${initialStateBackground.attributes.id}${backgrounds.map(background => `, .${background.activationClass as string}:target ~ #${background.attributes.id}`).join('')}`,
                              '  @include active-background'
                            )
                          } else {
                            sassLines.push(
                              `.${backgroundClass}`,
                              '  @include background',
                              `.${backgroundClass}:not(#${initialStateBackground.attributes.id}), :target:not(.${initialStateBackground.activationClass}) ~ #${initialStateBackground.attributes.id}`,
                              '  @include inactive-background',
                              `#${initialStateBackground.attributes.id}${backgrounds.filter(background => background !== initialStateBackground).map(background => `, .${background.activationClass as string}:target ~ #${background.attributes.id}`).join('')}`,
                              '  @include active-background'
                            )
                          }
                        }
                      }

                      let characterClass: null | string = null
                      let emoteClass: null | string = null

                      const characters: Character[] = []

                      const entryAnimations: string[] = []
                      const exitAnimations: string[] = []

                      for (const state of reorderedStates) {
                        for (let characterIndex = 0; characterIndex < ourMap.characters.length; characterIndex++) {
                          const mappedStateCharacter = state.state.characters[characterIndex] as MapStateCharacter

                          if (mappedStateCharacter.type === 'notPresent') {
                            continue
                          }

                          if (characterClass === null) {
                            characterClass = stringifyNumber(nextClass++)
                          }

                          const mappedCharacter = ourMap.characters[characterIndex] as MapCharacter

                          let character = characters.find(character => character.normalized === mappedCharacter.normalized)

                          if (character === undefined) {
                            character = {
                              attributes: {
                                class: characterClass,
                                id: stringifyNumber(nextId++)
                              },
                              normalized: mappedCharacter.normalized,
                              entryAnimations: [],
                              exitAnimations: [],
                              emotes: [],
                              presentClass: null
                            }

                            characters.push(character)
                          }

                          switch (mappedStateCharacter.type) {
                            case 'entering':
                              if (!character.entryAnimations.some(animation => animation.normalized === mappedStateCharacter.animation)) {
                                character.entryAnimations.push({
                                  normalized: mappedStateCharacter.animation,
                                  activationClass: stringifyNumber(nextClass++)
                                })
                              }

                              if (!entryAnimations.includes(mappedStateCharacter.animation)) {
                                entryAnimations.push(mappedStateCharacter.animation)
                              }
                              break

                            case 'present':
                              if (character.presentClass === null) {
                                character.presentClass = stringifyNumber(nextClass++)
                              }
                              break

                            case 'exiting':
                              if (!character.entryAnimations.some(animation => animation.normalized === mappedStateCharacter.animation)) {
                                character.entryAnimations.push({
                                  normalized: mappedStateCharacter.animation,
                                  activationClass: stringifyNumber(nextClass++)
                                })
                              }

                              if (!exitAnimations.includes(mappedStateCharacter.animation)) {
                                exitAnimations.push(mappedStateCharacter.animation)
                              }
                              break
                          }

                          const emote = mappedStateCharacter.emote

                          addSvgPathIfMissing(['characters', mappedCharacter.normalized, 'emotes', `${emote}.svg`])

                          if (!character.emotes.some(characterEmote => characterEmote.normalized === emote)) {
                            if (emoteClass === null) {
                              emoteClass = stringifyNumber(nextClass++)
                            }

                            character.emotes.push({
                              normalized: emote,
                              attributes: {
                                id: stringifyNumber(nextId++),
                                class: emoteClass
                              },
                              activationClass: stringifyNumber(nextClass++)
                            })
                          }
                        }
                      }

                      // TODO: microoptimize zero/one characters, animations, emotes, etc. here

                      if (characters.length > 0) {
                        for (const entryAnimation of entryAnimations) {
                          // TODO: account for initial state
                          sassLines.push(
                            characters.flatMap(character => character.entryAnimations.filter(animation => animation.normalized === entryAnimation).map(animation => `.${animation.activationClass}:target ~ #${character.attributes.id}`)).join(', '),
                            `  @include ${entryAnimation}-entry-animation`
                          )
                        }

                        for (const exitAnimation of exitAnimations) {
                          // TODO: account for initial state
                          sassLines.push(
                            characters.flatMap(character => character.entryAnimations.filter(animation => animation.normalized === exitAnimation).map(animation => `.${animation.activationClass}:target ~ #${character.attributes.id}`)).join(', '),
                            `  @include ${exitAnimation}-exit-animation`
                          )
                        }

                        if (emoteClass !== null) {
                          sassLines.push(
                            `.${emoteClass}`,
                            '  @include emote'
                          )

                          // TODO: account for initial state
                          sassLines.push(
                            characters.flatMap(character => character.emotes.map(emote => `.${emote.activationClass}:target ~ * #${emote.attributes.id}`)).join(', '),
                            '  @include active-emote'
                          )
                        }
                      }

                      for (let index = 0; index < svgs.length;) {
                        const path = (svgs[index] as Svg).path

                        if (svgPaths.some(match => match.length === path.length && match.every((item, itemIndex) => path[itemIndex] === item))) {
                          index++
                        } else {
                          svgPaths.splice(index, 1)
                        }
                      }

                      // TODO
                      mapped = {
                        sassLines,
                        states,
                        characters,
                        backgrounds
                      }
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
          const text = await fileSystem.readFile(['index.pug'], 'utf-8')
          pugTemplate = compilePug(text)
        })())
      }

      await Promise.all(initialPromises)

      if (skitscriptChanged || pugTemplateChanged || sassChanged || anySvgsChanged) {
        const absoluteMapped = mapped as Mapped

        const html = (pugTemplate as compileTemplate)({
          css,
          states: absoluteMapped.states.map(state => {
            // TODO: move this processing further up.
            const attributes: Record<string, string> = {
              class: state.attributes.class
            }

            if (state.attributes.id !== null) {
              attributes['id'] = state.attributes.id
            }

            if (state.attributes.href !== null) {
              attributes['href'] = state.attributes.href
            }

            return {
              attributes,
              content: state.content
            }
          }),
          backgrounds: absoluteMapped.backgrounds.map(background => {
            const svg = getSvgByPath(['backgrounds', `${background.normalized}.svg`])

            return {
              attributes: { ...background.attributes, ...svg.attributes },
              content: svg.content
            }
          }),
          characters: absoluteMapped.characters.map(character => {
            return {
              attributes: character.attributes,
              emotes: character.emotes.map(emote => {
                const svg = getSvgByPath(['characters', character.normalized, 'emotes', `${emote.normalized}.svg`])

                return {
                  attributes: { ...emote.attributes, ...svg.attributes },
                  content: svg.content
                }
              })
            }
          })
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

          // SVG often includes empty elements.
          removeEmptyElements: false,
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
