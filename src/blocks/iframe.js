import { createBlockShell } from './shared.js'
import { renderEmptyBlock } from './empty.js'

export function renderIframeBlock(block, { index }) {
  if (!block.url) {
    return renderEmptyBlock(block, { index })
  }

  const article = createBlockShell('iframe', index)
  const frameWrap = document.createElement('div')
  const iframe = document.createElement('iframe')

  frameWrap.className = 'iframe-card'
  iframe.src = block.url
  iframe.title = 'Embedded screen content'
  iframe.referrerPolicy = 'strict-origin-when-cross-origin'
  iframe.loading = 'eager'

  frameWrap.append(iframe)
  article.append(frameWrap)

  return article
}