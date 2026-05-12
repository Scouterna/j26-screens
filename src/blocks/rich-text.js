import { renderEmptyBlock } from './empty.js'
import { createBlockShell } from './shared.js'

export function renderRichTextBlock(block, { index }) {
  if (!hasMeaningfulRichText(block?.html)) {
    return renderEmptyBlock(block, { index })
  }

  const article = createBlockShell('rich-text', index)
  const content = document.createElement('div')

  content.className = 'rich-text'
  content.innerHTML = block.html
  article.append(content)

  return article
}

function hasMeaningfulRichText(html) {
  if (typeof html !== 'string' || !html.trim()) {
    return false
  }

  const visibleText = html
    .replace(/<br\s*\/?>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .trim()

  return visibleText.length > 0
}