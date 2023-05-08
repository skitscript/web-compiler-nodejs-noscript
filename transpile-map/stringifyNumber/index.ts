// TODO: there might be better character sets than this.
const characterSet = 'abcdefghijklmnopqrstuvwxyz'

export const stringifyNumber = (number: number): string => {
  if (number === 0) {
    return 'a'
  }

  let output = ''

  while (number > 0) {
    const remainder = number % characterSet.length

    output = `${characterSet.charAt(remainder)}${output}`

    number -= remainder
    number /= characterSet.length
  }

  return output
}
