import { type WebElementAttributes } from '@skitscript/types-nodejs'
import { type Emote } from '../Emote'

export interface Character {
  readonly normalized: string
  readonly element: {
    readonly attributes: WebElementAttributes
    readonly content: {
      readonly emotes: readonly Emote[]
    }
  }
}
