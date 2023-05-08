import { type Path, type WebState } from '@skitscript/types-nodejs'
import { type Character } from '../Character'
import { type Background } from '../Background'

export interface Data {
  readonly data: {
    readonly states: readonly WebState[]
    readonly backgrounds: readonly Background[]
    readonly characters: readonly Character[]
  }
  readonly sass: string
  readonly svgPaths: readonly Path[]
}
