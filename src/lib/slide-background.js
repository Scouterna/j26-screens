const FALLBACK_BACKGROUND_COLOR = 'var(--color-white)'
const EMERGENCY_LAYOUT_BACKGROUND_COLORS = {
  emergency_code_red: 'var(--color-background-danger-bold-base)',
  emergency_code_yellow: 'var(--color-roveryellow-100)',
}

export function normalizeSlideBackground(layoutName) {
  const color = EMERGENCY_LAYOUT_BACKGROUND_COLORS[normalizeLayoutName(layoutName)]

  return {
    color: color || FALLBACK_BACKGROUND_COLOR,
  }
}

export function isEmergencyLayoutName(layoutName) {
  return Boolean(EMERGENCY_LAYOUT_BACKGROUND_COLORS[normalizeLayoutName(layoutName)])
}

function normalizeLayoutName(layoutName) {
  if (typeof layoutName !== 'string') {
    return ''
  }

  return layoutName.trim().toLowerCase()
}