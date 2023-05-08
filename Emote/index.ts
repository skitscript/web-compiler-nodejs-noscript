import { type Image } from '../Image'

export interface Emote extends Image {
  readonly normalized: string
}
