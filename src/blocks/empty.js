import { createBlockShell, createMessageCard } from './shared.js'

export function renderEmptyBlock(_block, { index }) {
  const article = createBlockShell('empty', index)

  article.append(createMessageCard('🦀', 'Se väl för ut'))
  return article
}