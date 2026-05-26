import defaultSlidesUrl from './assets/j26_default.json?url'
import './style.css'
import { normalizeSlides } from './lib/screen-content.js'
import { renderSlideLayout } from './layouts/index.js'
import { createTicker } from './ticker/index.js'

const DEFAULT_SLUG = 'j26_default'
const SAME_ORIGIN_API_BASE = '/_services/cms/api/screens'
const REMOTE_API_BASE = 'https://app.dev.j26.se/_services/cms/api/screens'
const DEFAULT_REFRESH_MINUTES = 2
const MIN_REFRESH_INTERVAL_MS = 15000
const DEFAULT_STAGE_FIT = 'cover'

const app = document.querySelector('#app')

const state = {
  slides: [],
  slideIndex: 0,
  rotationTimer: 0,
  refreshTimer: 0,
  refreshInFlight: false,
  slidesSignature: '',
  activeApiBase: '',
  etag: '',
  lastModified: '',
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
    const initialLoad = await loadSlides(runtime)
    const slides = initialLoad.slides

    if (!slides.length) {
      throw new Error('API:et returnerade inga slides.')
    }

    state.slides = slides
    state.slidesSignature = createSlidesSignature(slides)
    state.slideIndex = 0
    updateRefreshMetadata(initialLoad)

    renderActiveSlide()
    startRotation()
    startRefreshLoop(runtime)
  } catch (error) {
    renderError(error, runtime.slug)
  }
}

async function loadSlides(runtime, options = {}) {
  if (runtime.slug === DEFAULT_SLUG) {
    const result = await fetchSlides(defaultSlidesUrl, 'standardinnehållet')

    if (result.notModified) {
      return {
        slides: state.slides,
        notModified: true,
      }
    }

    return {
      slides: normalizeSlides(result.payload),
      notModified: false,
      etag: result.etag,
      lastModified: result.lastModified,
    }
  }

  let lastError = null
  const preferredApiBases = prioritizeApiBases(runtime.apiBases)

  for (const apiBase of preferredApiBases) {
    const endpoint = buildEndpoint(apiBase, runtime.slug)
    const useValidators = Boolean(options.background) && apiBase === state.activeApiBase

    try {
      const result = await fetchSlides(
        endpoint,
        'endpointen',
        useValidators
          ? {
              etag: state.etag,
              lastModified: state.lastModified,
            }
          : undefined,
      )

      if (result.notModified) {
        return {
          slides: state.slides,
          notModified: true,
          apiBase,
          etag: result.etag,
          lastModified: result.lastModified,
        }
      }

      return {
        slides: normalizeSlides(result.payload),
        notModified: false,
        apiBase,
        etag: result.etag,
        lastModified: result.lastModified,
      }
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
  const refreshIntervalMs = getRefreshIntervalMs(params, slug)
  const stageFit = getStageFit(params)

  if (explicitApiBase) {
    return {
      slug,
      apiBases: [explicitApiBase],
      animationsEnabled,
      refreshIntervalMs,
      stageFit,
    }
  }

  return {
    slug,
    apiBases: isLocalHost() ? [SAME_ORIGIN_API_BASE, REMOTE_API_BASE] : [SAME_ORIGIN_API_BASE],
    animationsEnabled,
    refreshIntervalMs,
    stageFit,
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

function getRefreshIntervalMs(params, slug) {
  const refreshToggle = params.get('refresh')?.trim().toLowerCase()

  if (refreshToggle === 'off') {
    return 0
  }

  const rawMinutes =
    params.get('refreshMinutes')?.trim() || import.meta.env.VITE_SCREENS_REFRESH_MINUTES?.trim()
  const fallbackMinutes = slug === DEFAULT_SLUG ? 0 : DEFAULT_REFRESH_MINUTES
  const refreshMinutes = getNumber(rawMinutes, fallbackMinutes)

  if (refreshMinutes <= 0) {
    return 0
  }

  return Math.max(Math.round(refreshMinutes * 60 * 1000), MIN_REFRESH_INTERVAL_MS)
}

function getNumber(value, fallback) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return parsed
}

function getStageFit(params) {
  const fit = params.get('stageFit')?.trim().toLowerCase()

  if (fit === 'contain') {
    return 'contain'
  }

  return DEFAULT_STAGE_FIT
}

function prioritizeApiBases(apiBases) {
  if (!state.activeApiBase || !apiBases.includes(state.activeApiBase)) {
    return apiBases
  }

  return [state.activeApiBase, ...apiBases.filter((apiBase) => apiBase !== state.activeApiBase)]
}

function buildEndpoint(apiBase, slug) {
  return `${sanitizeApiBase(apiBase)}/${encodeURIComponent(slug)}/content`
}

async function fetchSlides(resource, sourceLabel, validators = {}) {
  const headers = {
    accept: 'application/json',
  }

  if (validators.etag) {
    headers['if-none-match'] = validators.etag
  }

  if (validators.lastModified) {
    headers['if-modified-since'] = validators.lastModified
  }

  const response = await fetch(resource, {
    headers,
    cache: 'no-cache',
  })

  const etag = response.headers.get('etag') || validators.etag || ''
  const lastModified = response.headers.get('last-modified') || validators.lastModified || ''

  if (response.status === 304) {
    return {
      notModified: true,
      etag,
      lastModified,
    }
  }

  if (!response.ok) {
    throw new Error(`Kunde inte läsa ${sourceLabel} (${response.status} ${response.statusText}).`)
  }

  return {
    notModified: false,
    payload: await response.json(),
    etag,
    lastModified,
  }
}

function createSlidesSignature(slides) {
  return JSON.stringify(slides)
}

function updateRefreshMetadata(loadResult) {
  if (!loadResult) {
    return
  }

  if (loadResult.apiBase) {
    state.activeApiBase = loadResult.apiBase
  }

  state.etag = loadResult.etag || ''
  state.lastModified = loadResult.lastModified || ''
}

function startRefreshLoop(runtime) {
  window.clearTimeout(state.refreshTimer)

  if (runtime.refreshIntervalMs <= 0) {
    return
  }

  const runLoop = () => {
    state.refreshTimer = window.setTimeout(async () => {
      await refreshSlides(runtime)
      runLoop()
    }, runtime.refreshIntervalMs)
  }

  runLoop()
}

async function refreshSlides(runtime) {
  if (state.refreshInFlight) {
    return
  }

  state.refreshInFlight = true

  try {
    const result = await loadSlides(runtime, { background: true })

    updateRefreshMetadata(result)

    if (result.notModified || !result.slides.length) {
      return
    }

    const nextSignature = createSlidesSignature(result.slides)

    if (nextSignature === state.slidesSignature) {
      return
    }

    const currentSlideId = state.slides[state.slideIndex]?.id

    state.slides = result.slides
    state.slidesSignature = nextSignature

    if (currentSlideId) {
      const matchedIndex = state.slides.findIndex((slide) => slide.id === currentSlideId)

      if (matchedIndex >= 0) {
        state.slideIndex = matchedIndex
      } else if (state.slideIndex >= state.slides.length) {
        state.slideIndex = 0
      }
    } else {
      state.slideIndex = 0
    }

    renderActiveSlide()
    startRotation()
  } catch (error) {
    console.warn('Bakgrundsuppdatering misslyckades.', error)
  } finally {
    state.refreshInFlight = false
  }
}

function renderShell(runtime) {
  const shell = document.createElement('div')
  const stage = document.createElement('div')
  const main = document.createElement('main')
  const slideIndicator = document.createElement('div')

  shell.className = 'screen-shell'
  shell.dataset.animations = runtime.animationsEnabled ? 'on' : 'off'
  shell.dataset.stageFit = runtime.stageFit
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
