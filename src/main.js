import defaultSlidesUrl from './assets/j26_default.json?url'
import './style.css'
import { normalizeSlides } from './lib/screen-content.js'
import { renderSlideLayout } from './layouts/index.js'
import { createTicker } from './ticker/index.js'

const DEFAULT_SLUG = 'j26_default'
const SAME_ORIGIN_API_BASE = '/_services/cms/api/screens'
const REMOTE_API_BASE = 'https://app.dev.j26.se/_services/cms/api/screens'

const app = document.querySelector('#app')

const state = {
  slides: [],
  slideIndex: 0,
  rotationTimer: 0,
}

let stageElement
let slideIndicatorElement

boot()

async function boot() {
  const runtime = getRuntimeConfig()

  renderShell(runtime)
  renderStageState({
    title: 'Hämtar skärminnehåll',
    body: 'Försöker läsa slide-data från CMS och bygga upp layouts dynamiskt.',
  })

  try {
    const slides = await loadSlides(runtime)

    if (!slides.length) {
      throw new Error('API:et returnerade inga slides.')
    }

    state.slides = slides
    state.slideIndex = 0

    renderActiveSlide()
    startRotation()
  } catch (error) {
    renderError(error, runtime.slug)
  }
}

async function loadSlides(runtime) {
  if (runtime.slug === DEFAULT_SLUG) {
    const payload = await fetchSlides(defaultSlidesUrl, 'standardinnehållet')
    return normalizeSlides(payload)
  }

  let lastError = null

  for (const apiBase of runtime.apiBases) {
    const endpoint = buildEndpoint(apiBase, runtime.slug)

    try {
      const payload = await fetchSlides(endpoint, 'endpointen')
      return normalizeSlides(payload)
    } catch (error) {
      lastError = error
    }
  }

  throw lastError ?? new Error('Kunde inte läsa API-data.')
}

function getRuntimeConfig() {
  const params = new URLSearchParams(window.location.search)
  const explicitApiBase = sanitizeApiBase(
    params.get('apiBase')?.trim() || import.meta.env.VITE_SCREENS_API_BASE?.trim(),
  )
  const slug = params.get('slug')?.trim() || DEFAULT_SLUG
  const animationsEnabled = params.get('animation')?.trim().toLowerCase() !== 'off'

  if (explicitApiBase) {
    return {
      slug,
      apiBases: [explicitApiBase],
      animationsEnabled,
    }
  }

  return {
    slug,
    apiBases: isLocalHost() ? [SAME_ORIGIN_API_BASE, REMOTE_API_BASE] : [SAME_ORIGIN_API_BASE],
    animationsEnabled,
  }
}

function isLocalHost() {
  return ['localhost', '127.0.0.1'].includes(window.location.hostname)
}

function sanitizeApiBase(value) {
  if (!value) {
    return ''
  }

  return value.replace(/\/+$/, '')
}

function buildEndpoint(apiBase, slug) {
  return `${sanitizeApiBase(apiBase)}/${encodeURIComponent(slug)}/content`
}

async function fetchSlides(resource, sourceLabel) {
  const response = await fetch(resource, {
    headers: {
      accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Kunde inte läsa ${sourceLabel} (${response.status} ${response.statusText}).`)
  }

  return response.json()
}

function renderShell(runtime) {
  const shell = document.createElement('div')
  const stage = document.createElement('div')
  const main = document.createElement('main')
  const slideIndicator = document.createElement('div')

  shell.className = 'screen-shell'
  shell.dataset.animations = runtime.animationsEnabled ? 'on' : 'off'
  stage.className = 'screen-stage'
  main.className = 'screen-stage__content'
  main.dataset.role = 'stage'
  slideIndicator.className = 'screen-stage__indicator'
  slideIndicator.hidden = true
  slideIndicator.setAttribute('aria-live', 'polite')

  stage.append(main, slideIndicator, createTicker())
  shell.append(stage)
  app.replaceChildren(shell)

  stageElement = main
  slideIndicatorElement = slideIndicator
}

function renderActiveSlide() {
  const slide = state.slides[state.slideIndex]

  if (!slide) {
    return
  }

  stageElement.replaceChildren(renderSlideLayout(slide))
  renderSlideIndicator()
}

function startRotation() {
  window.clearTimeout(state.rotationTimer)

  const slide = state.slides[state.slideIndex]

  if (!slide) {
    return
  }

  if (state.slides.length < 2) {
    return
  }

  state.rotationTimer = window.setTimeout(() => {
    state.slideIndex = (state.slideIndex + 1) % state.slides.length
    renderActiveSlide()
    startRotation()
  }, slide.durationSeconds * 1000)
}

function renderStageState({ title, body }) {
  const section = document.createElement('section')
  const panel = document.createElement('div')
  const eyebrow = document.createElement('p')
  const titleElement = document.createElement('h1')
  const bodyElement = document.createElement('p')

  section.className = 'state-card'
  panel.className = 'state-card__panel'
  eyebrow.className = 'state-card__eyebrow'
  titleElement.className = 'state-card__title'
  bodyElement.className = 'state-card__body'

  eyebrow.textContent = 'Screen renderer'
  titleElement.textContent = title
  bodyElement.textContent = body

  panel.append(eyebrow, titleElement, bodyElement)
  section.append(panel)
  stageElement.replaceChildren(section)
  renderSlideIndicator()
}

function renderSlideIndicator() {
  if (!slideIndicatorElement) {
    return
  }

  if (state.slides.length < 2) {
    slideIndicatorElement.hidden = true
    slideIndicatorElement.replaceChildren()
    slideIndicatorElement.removeAttribute('aria-label')
    return
  }

  const fragment = document.createDocumentFragment()

  slideIndicatorElement.hidden = false
  slideIndicatorElement.setAttribute(
    'aria-label',
    `Slide ${state.slideIndex + 1} av ${state.slides.length}`,
  )

  for (let index = 0; index < state.slides.length; index += 1) {
    const dot = document.createElement('span')

    dot.className = 'screen-stage__indicator-dot'
    dot.dataset.active = index === state.slideIndex ? 'true' : 'false'
    dot.setAttribute('aria-hidden', 'true')
    fragment.append(dot)
  }

  slideIndicatorElement.replaceChildren(fragment)
}

function renderError(error, slug) {
  const message = error instanceof Error ? error.message : 'Okänt fel vid hämtning av innehåll.'

  renderStageState({
    title: 'Kunde inte läsa innehåll',
    body: `${message} Kontrollera slug ${slug} eller peka om.`,
  })
}
