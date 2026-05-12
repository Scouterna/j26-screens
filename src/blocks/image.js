import { createBlockShell } from './shared.js'
import { renderEmptyBlock } from './empty.js'

export function renderImageBlock(block, { index }) {
  if (!block.src) {
    return renderEmptyBlock(block, { index })
  }

  const article = createBlockShell('image', index)
  const figure = document.createElement('figure')
  const image = document.createElement('img')

  figure.className = 'media-card'
  image.src = block.src
  image.alt = block.alt || 'Slide image'
  image.decoding = 'async'
  figure.append(image)

  if (block.caption) {
    const caption = document.createElement('figcaption')
    caption.textContent = block.caption
    figure.append(caption)
  }

  article.append(figure)
  return article
}