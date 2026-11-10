/**
 * Native treats a string-first array as an expression. Make the font stack an
 * explicit literal so it cannot be parsed as an operator named after the font.
 * The same expression is valid in MapLibre GL JS.
 */
export const mapTextFont: ['literal', string[]] = [
  'literal',
  ['Noto Sans Bold'],
]
