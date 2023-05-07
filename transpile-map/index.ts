import { WebState, type Path, type ValidMap, type WebCharacter, type WebBackground, type MapState } from '@skitscript/types-nodejs'
import { Data } from '../Data'
import { State } from '../State'

const remapStateIndex = (stateIndex: number, mapStatesLength: number): number => stateIndex > 0 ? stateIndex - 1 : mapStatesLength - 1

export const transpileMap = (map: ValidMap): { readonly data: Data, readonly sassLines: readonly string[], readonly svgPaths: readonly Path[] } => {
  const reorderedMapStates = [...map.states.slice(1), map.states[0] as MapState]
    .map(mapState => ({
      ...mapState,
      interaction: mapState.interaction.type === 'dismiss'
        ? { ...mapState.interaction, stateIndex: remapStateIndex(mapState.interaction.stateIndex, map.states.length) }
        : {
            ...mapState.interaction,
            options: mapState.interaction.options.map(mapStateOption => ({
              ...mapStateOption,
              stateIndex: remapStateIndex(mapStateOption.stateIndex, map.states.length)
            }))
          }
    }))

  const characters: WebCharacter[] = []
  const backgrounds: WebBackground[] = []

  const sassLines: string[] = []
  const svgPaths: Path[] = []

  // const addSvgPathIfMissing = (path: Path): void => {
  //   if (!svgPaths.some(existing => existing.length === path.length && existing.every((item, index) => path[index] === item))) {
  //     svgPaths.push(path)
  //   }
  // }

  const nextUniqueId = 0

    const states = reorderedMapStates.map((mapState): State => ({

    }))

  return {
    data: {
      states,
      characters,
      backgrounds
    },
    sassLines,
    svgPaths
  }
}
