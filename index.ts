import { parse } from '@skitscript/parser-nodejs'
import { map } from '@skitscript/mapper-nodejs'
import type { MapStateCharacter, MapCharacter } from '@skitscript/types-nodejs'
import type { compileTemplate } from 'pug'
import { minify } from 'html-minifier'

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
  let mapped: null | {} = null
  let pugTemplate: null | compileTemplate = null
  let css: null | string = null
  const svgPaths: Path[] = []

  const addSvgPathIfMissing = (path: Path): void => {
    if (!svgPaths.some(existing => existing.length === path.length && existing.every((item, index) => path[index] === item))) {
      svgPaths.push(path)
    }
  }

  interface Svg {
    readonly path: Path
  }

  const svgs: Svg[] = []

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

      const loadSvgs = async (): Promise<void> => {
        const changedSvgPaths = svgPaths.filter(svgPath => !svgs.some(svg => svg.path.length === svgPath.length && svg.path.every((item, index) => svgPath[index] === item)))

        anySvgsChanged = changedSvgPaths.length > 0

        await Promise.all(changedSvgPaths.map(async svg => {
          const text = await fileSystem.readFile(svg, 'utf-8')

          // TODO!
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
              const mapped = map(parsed)

              switch (mapped.type) {
                case 'invalid':
                  throw new Error('TODO')

                case 'valid':
                {
                  for (const state of mapped.states) {
                    if (state.background !== null) {
                      addSvgPathIfMissing(['backgrounds', `${state.background}.svg`])
                    }

                    for (let characterIndex = 0; characterIndex < mapped.characters.length; characterIndex++) {
                      const mappedStateCharacter = state.characters[characterIndex] as MapStateCharacter

                      if (mappedStateCharacter.type === 'notPresent') {
                        continue
                      }

                      const mappedCharacter = mapped.characters[characterIndex] as MapCharacter

                      addSvgPathIfMissing(['characters', mappedCharacter.normalized, 'emotes', `${mappedStateCharacter.emote}.svg`])
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

                  await loadSvgs()
                }
              }
            }
          }
        })())
      } else {
        initialPromises.push(loadSvgs())
      }

      if (pugTemplateChanged) {
        // TODO
      }

      if (sassChanged) {
        // TODO
      }

      await Promise.all(initialPromises)

      if (skitscriptChanged || pugTemplateChanged || sassChanged || anySvgsChanged) {
      // TODO: render pug
      // TODO: minify html
      // TODO: write HTML
      // TODO: zip/copy
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
