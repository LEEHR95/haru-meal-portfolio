import ReactGA from 'react-ga4'

const measurementId = (import.meta.env.VITE_GA_MEASUREMENT_ID || '').trim()
let initialized = false

function devLog(message) {
  if (import.meta.env.DEV) {
    console.log(`[GA] ${message}`)
  }
}

export function isAnalyticsEnabled() {
  return Boolean(measurementId)
}

export function initAnalytics() {
  if (!measurementId || initialized) return
  ReactGA.initialize(measurementId)
  initialized = true
}

export function trackPageView(page) {
  if (!measurementId) return
  initAnalytics()
  ReactGA.send({
    hitType: 'pageview',
    page,
  })
  devLog(`pageview ${page}`)
}

export function trackIngredientSearch() {
  if (!measurementId) return
  initAnalytics()
  ReactGA.event({
    category: 'ingredient',
    action: 'search',
  })
  devLog('ingredient search')
}

export function trackChatQuestion() {
  if (!measurementId) return
  initAnalytics()
  ReactGA.event({
    category: 'chat',
    action: 'question',
  })
  devLog('chat question')
}

export function trackContactSubmit() {
  if (!measurementId) return
  initAnalytics()
  ReactGA.event({
    category: 'contact',
    action: 'submit',
  })
  devLog('contact submit')
}
