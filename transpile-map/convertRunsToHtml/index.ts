import { type MapStateRun } from '@skitscript/types-nodejs'
import { escape } from 'html-escaper'

export const convertRunsToHtml = (runs: readonly MapStateRun[]): string => {
  let output = ''

  const stack: Array<'em' | 'strong' | 'code'> = []

  for (const run of [...runs, { bold: false, italic: false, code: false, plainText: '' }]) {
    while (stack.includes('strong') && !run.bold) {
      output += `</${stack.pop() as string}>`
    }

    while (stack.includes('em') && !run.italic) {
      output += `</${stack.pop() as string}>`
    }

    while (stack.includes('code') && !run.code) {
      output += `</${stack.pop() as string}>`
    }

    if (run.bold && !stack.includes('strong')) {
      output += '<strong>'
      stack.push('strong')
    }

    if (run.italic && !stack.includes('em')) {
      output += '<em>'
      stack.push('em')
    }

    if (run.code && !stack.includes('code')) {
      output += '<code>'
      stack.push('code')
    }

    output += escape(run.plainText)
  }

  return output
}
