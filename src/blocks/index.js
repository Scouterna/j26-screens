import { renderEmptyBlock } from './empty.js'
import { renderIframeBlock } from './iframe.js'
import { renderImageBlock } from './image.js'
import { renderRichTextBlock } from './rich-text.js'

const BLOCK_RENDERERS = {
  'rich-text': renderRichTextBlock,
  image: renderImageBlock,
  iframe: renderIframeBlock,
  empty: renderEmptyBlock,
}

export function renderBlock(block, index) {
  const renderer = BLOCK_RENDERERS[block?.type] ?? renderEmptyBlock
  const safeBlock = block?.type ? block : { type: 'empty' }

  return renderer(safeBlock, { index })
}