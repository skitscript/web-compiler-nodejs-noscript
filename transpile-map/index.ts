import { type ValidMap, type MapStateCharacter, type MapCharacter, type WebState, type MapState, type WebSpeaker, type WebOption, type WebSpeakers, type WebLine } from '@skitscript/types-nodejs'
import { type Data } from '../Data'
import { stringifyNumber } from './stringifyNumber'
import { type Character } from '../Character'
import { type Emote } from '../Emote'
import { convertRunsToHtml } from './convertRunsToHtml'
import { type Background } from '../Background'

interface TemporaryThing {
  readonly normalized: string
  readonly classUniqueId: number
  readonly idUniqueId: number
  readonly classUniqueIds: number[]
}

interface TemporaryCharacter {
  readonly normalized: string
  readonly verbatim: string
  readonly emotes: TemporaryThing[]
  readonly entryAnimations: TemporaryThing[]
  readonly exitAnimations: TemporaryThing[]
  presenceClassUniqueId: null | number
  idUniqueId: number
  classUniqueIds: number[]
}

interface TemporaryState {
  readonly mapState: MapState
  readonly classUniqueIds: number[]
  readonly idUniqueId: number
  readonly speakers: null | WebSpeakers
}

export const transpileMap = (map: ValidMap): Data => {
  const temporaryCharacters: TemporaryCharacter[] = []
  const temporaryBackgrounds: TemporaryThing[] = []

  let nextUniqueId = map.states.length
  const stateClassUniqueId = nextUniqueId++
  const optionClassUniqueId = nextUniqueId++
  const backgroundClassUniqueId = nextUniqueId++
  const characterClassUniqueId = nextUniqueId++
  const emoteClassUniqueId = nextUniqueId++

  const temporaryStates = map.states.map((mapState, mapStateUniqueId): TemporaryState => {
    const classUniqueIds: number[] = [stateClassUniqueId]

    if (mapState.background !== null) {
      let temporaryBackground = temporaryBackgrounds.find(temporaryBackground => temporaryBackground.normalized === mapState.background)

      if (temporaryBackground === undefined) {
        temporaryBackground = {
          normalized: mapState.background,
          classUniqueId: nextUniqueId++,
          idUniqueId: nextUniqueId++,
          classUniqueIds: [backgroundClassUniqueId]
        }

        temporaryBackgrounds.push(temporaryBackground)
      }

      classUniqueIds.push(temporaryBackground.classUniqueId)
    }

    const speakersContent: WebSpeaker[] = []

    for (let characterIndex = 0; characterIndex < map.characters.length; characterIndex++) {
      const mapCharacter = map.characters[characterIndex] as MapCharacter

      if (mapState.speakers.includes(mapCharacter.normalized)) {
        speakersContent.push({
          normalized: mapCharacter.normalized,
          verbatim: mapCharacter.verbatim
        })
      }

      const mapStateCharacter = mapState.characters[characterIndex] as MapStateCharacter

      if (mapStateCharacter.type === 'notPresent') {
        continue
      }

      let temporaryCharacter = temporaryCharacters.find(temporaryCharacter => temporaryCharacter.normalized === mapCharacter.normalized)

      if (temporaryCharacter === undefined) {
        temporaryCharacter = {
          normalized: mapCharacter.normalized,
          verbatim: mapCharacter.verbatim,
          emotes: [],
          entryAnimations: [],
          exitAnimations: [],
          presenceClassUniqueId: null,
          idUniqueId: nextUniqueId++,
          classUniqueIds: [characterClassUniqueId]
        }

        temporaryCharacters.push(temporaryCharacter)
      }

      let temporaryEmote = temporaryCharacter.emotes.find(temporaryEmote => temporaryEmote.normalized === mapStateCharacter.emote)

      if (temporaryEmote === undefined) {
        temporaryEmote = {
          normalized: mapStateCharacter.emote,
          classUniqueId: nextUniqueId++,
          idUniqueId: nextUniqueId++,
          classUniqueIds: [emoteClassUniqueId]
        }

        temporaryCharacter.emotes.push(temporaryEmote)
      }

      classUniqueIds.push(temporaryEmote.classUniqueId)

      switch (mapStateCharacter.type) {
        case 'entering':{
          let temporaryEntryAnimation = temporaryCharacter.entryAnimations.find(temporaryEntryAnimation => temporaryEntryAnimation.normalized === mapStateCharacter.animation)

          if (temporaryEntryAnimation === undefined) {
            temporaryEntryAnimation = {
              normalized: mapStateCharacter.animation,
              classUniqueId: nextUniqueId++,
              idUniqueId: nextUniqueId++,
              classUniqueIds: []
            }

            temporaryCharacter.entryAnimations.push(temporaryEntryAnimation)
            temporaryCharacter.classUniqueIds.push(temporaryEntryAnimation.classUniqueId)
          }

          classUniqueIds.push(temporaryEntryAnimation.classUniqueId)
          break
        }

        case 'present':
          if (temporaryCharacter.presenceClassUniqueId === null) {
            temporaryCharacter.presenceClassUniqueId = nextUniqueId++
            temporaryCharacter.classUniqueIds.push(temporaryCharacter.presenceClassUniqueId)
          }

          classUniqueIds.push(temporaryCharacter.presenceClassUniqueId)
          break

        case 'exiting':{
          let temporaryExitAnimation = temporaryCharacter.exitAnimations.find(temporaryExitAnimation => temporaryExitAnimation.normalized === mapStateCharacter.animation)

          if (temporaryExitAnimation === undefined) {
            temporaryExitAnimation = {
              normalized: mapStateCharacter.animation,
              classUniqueId: nextUniqueId++,
              idUniqueId: nextUniqueId++,
              classUniqueIds: []
            }

            temporaryCharacter.exitAnimations.push(temporaryExitAnimation)
            temporaryCharacter.classUniqueIds.push(temporaryExitAnimation.classUniqueId)
          }

          classUniqueIds.push(temporaryExitAnimation.classUniqueId)
          break
        }
      }
    }

    speakersContent.sort((a, b) => a.verbatim.localeCompare(b.verbatim))

    return {
      mapState,
      classUniqueIds,
      idUniqueId: mapStateUniqueId,
      speakers: speakersContent.length === 0
        ? null
        : {
            element: {
              tagName: 'div',
              attributes: {},
              content: speakersContent
            }
          }
    }
  })

  const generatedClasses: number[] = []

  const getClassByUniqueId = (uniqueId: number): string => {
    let index = generatedClasses.indexOf(uniqueId)

    if (index === -1) {
      index = generatedClasses.length
      generatedClasses.push(uniqueId)
    }

    return stringifyNumber(index)
  }

  const generatedIds: number[] = []

  const getIdByUniqueId = (uniqueId: number): string => {
    let index = generatedIds.indexOf(uniqueId)

    if (index === -1) {
      index = generatedIds.length
      generatedIds.push(uniqueId)
    }

    return stringifyNumber(index)
  }

  const states = [...temporaryStates.slice(1), temporaryStates[0] as TemporaryState].map((temporaryState): WebState => {
    const id = getIdByUniqueId(temporaryState.idUniqueId)
    const classes = temporaryState.classUniqueIds.map(getClassByUniqueId).join(' ')

    const line: null | WebLine = temporaryState.mapState.line === null
      ? null
      : {
          element: {
            tagName: 'pre',
            attributes: {},
            content: convertRunsToHtml(temporaryState.mapState.line)
          }
        }

    const speakers = temporaryState.speakers

    if (temporaryState.mapState.interaction.type === 'dismiss') {
      return {
        element: {
          tagName: 'a',
          attributes: {
            id,
            class: classes,
            href: `#${getIdByUniqueId(temporaryState.mapState.interaction.stateIndex)}`
          },
          content: {
            line,
            speakers,
            menu: null
          }
        }
      }
    } else {
      return {
        element: {
          tagName: 'div',
          attributes: {
            id,
            class: classes
          },
          content: {
            line,
            speakers,
            menu: {
              element: {
                tagName: 'div',
                attributes: {},
                content: temporaryState.mapState.interaction.options.map((option): WebOption => ({
                  element: {
                    tagName: 'a',
                    attributes: {
                      class: getClassByUniqueId(optionClassUniqueId)
                    },
                    content: convertRunsToHtml(option.content)
                  }
                }))
              }
            }
          }
        }
      }
    }
  })

  const backgrounds = temporaryBackgrounds.map((temporaryBackground): Background => ({
    normalized: temporaryBackground.normalized,
    path: ['backgrounds', `${temporaryBackground.normalized}.svg`],
    element: {
      attributes: {
        class: temporaryBackground.classUniqueIds.map(getClassByUniqueId).join(' '),
        id: getIdByUniqueId(temporaryBackground.idUniqueId)
      }
    }
  }))

  const characters = temporaryCharacters.map((temporaryCharacter): Character => ({
    normalized: temporaryCharacter.normalized,
    element: {
      attributes: {
        class: temporaryCharacter.classUniqueIds.map(getClassByUniqueId).join(' '),
        id: getIdByUniqueId(temporaryCharacter.idUniqueId)
      },
      content: {
        emotes: temporaryCharacter.emotes.map((temporaryEmote): Emote => ({
          normalized: temporaryEmote.normalized,
          path: ['characters', temporaryCharacter.normalized, 'emotes', `${temporaryEmote.normalized}.svg`],
          element: {
            attributes: {
              class: temporaryEmote.classUniqueIds.map(getClassByUniqueId).join(' '),
              id: getIdByUniqueId(temporaryEmote.idUniqueId)
            }
          }
        }))
      }
    }
  }))

  const sass = ''

  const svgPaths = [
    ...backgrounds.map(background => background.path),
    ...characters.flatMap(character => character.element.content.emotes.map(emote => emote.path))
  ]

  return {
    data: {
      states,
      characters,
      backgrounds
    },
    sass,
    svgPaths
  }
}
