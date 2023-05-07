import { optimize } from 'svgo'

export const minifySvg = (svg: string): string => optimize(svg, {
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
}).data
