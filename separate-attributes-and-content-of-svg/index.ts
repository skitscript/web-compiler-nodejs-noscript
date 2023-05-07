import { type WebElementAttributes } from '@skitscript/types-nodejs'
import { XMLBuilder, XMLParser } from 'fast-xml-parser'

const xmlSettings = {
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: ''
}

const xmlParser = new XMLParser(xmlSettings)
const xmlBuilder = new XMLBuilder(xmlSettings)

export const separateAttributesAndContentOfSvg = (svg: string): { readonly attributes: WebElementAttributes, readonly content: string } => {
  const parsed = xmlParser.parse(svg)
  const attributes = parsed[0][':@']
  const content = xmlBuilder.build(parsed[0].svg)

  return { attributes, content }
}
