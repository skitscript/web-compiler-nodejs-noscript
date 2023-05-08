import { type Path, type WebElementAttributes } from '@skitscript/types-nodejs'

export interface Image {
  readonly path: Path
  readonly element: {
    readonly attributes: WebElementAttributes
  }
}
