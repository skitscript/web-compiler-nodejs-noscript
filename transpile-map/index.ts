import { type WebState, type Path, type ValidMap, type WebCharacter, type WebBackground } from '@skitscript/types-nodejs'

export const transpileMap = (_map: ValidMap): { readonly data: Omit<WebData, 'css'>, readonly sassLines: readonly string[], readonly svgPaths: readonly Path[] } => {
  const states: WebState[] = []
  const characters: WebCharacter[] = []
  const backgrounds: WebBackground[] = []

  const sassLines: string[] = []
  const svgPaths: Path[] = []

  // const addSvgPathIfMissing = (path: Path): void => {
  //   if (!svgPaths.some(existing => existing.length === path.length && existing.every((item, index) => path[index] === item))) {
  //     svgPaths.push(path)
  //   }
  // }

  return {
    data: {
      javascript: '',
      states,
      characters,
      backgrounds
    },
    sassLines,
    svgPaths
  }
}
