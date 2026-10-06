/**
 * The town tune editor: sixteen vertical sliders, one per beat.
 * Slider values are 1-based indexes into NOTES.
 */
const $ = window.jQuery
const ipc = require('electron').ipcRenderer
const i18n = require('./i18n')

const NOTES = ['zZz', '-', 'G0', 'A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'A2', 'B2', 'C2', 'D2', 'E2', '?']
const BEATS = 16
const BLINK_MS = 350

let blinker = null

const sliders = () => $('.tune-settings input[type="range"]')

const setValue = (input, value) => {
  input.value = value
  input.setAttribute('c', input.value)
}

const build = () => {
  const markup = Array.from({ length: BEATS }, () =>
    '<label><input type="range" class="tune-slider" step="1" min="1" max="16"><span></span></label>'
  ).join('')
  $('.creator .inputs').html(markup)

  sliders()
    .on('wheel', e => {
      e.preventDefault()
      e.stopPropagation()
      const input = e.currentTarget
      setValue(input, input.valueAsNumber + (e.originalEvent.deltaY < 0 ? 1 : -1))
      input.dispatchEvent(new window.CustomEvent('input'))
    })
    .on('click', e => e.currentTarget.dispatchEvent(new window.CustomEvent('input')))
    .on('input', e => {
      setValue(e.currentTarget, e.currentTarget.value)
      ipc.send('toPlayer', ['playNote', e.currentTarget.value])
    })

  $('#save_tune').on('click', () => {
    const tune = sliders().map((i, e) => NOTES[e.value - 1]).get()
    ipc.send('toPlayer', ['tune', tune])
    flash($('#save_tune'))
  })

  $('#play_tune').on('click', () => {
    const steps = sliders().map((i, e) => e.value).get()
    ipc.send('toPlayer', ['playTune', steps])
    blink(steps.length)
  })
}

/** Loads a saved tune (array of note names) into the sliders. */
const load = tune => {
  sliders().each((i, input) => setValue(input, NOTES.indexOf(tune[i]) + 1 || 1))
}

const flash = button => {
  button.text(i18n.t(button.attr('data-i18n-alt')))
  setTimeout(() => button.text(i18n.t(button.attr('data-i18n'))), 1000)
}

/** Highlights each beat in turn while the tune plays. */
const blink = count => {
  clearInterval(blinker)
  const labels = $('.tune-settings label')
  let i = 0
  labels.removeClass('blink').eq(0).addClass('blink')
  blinker = setInterval(() => {
    i++
    labels.removeClass('blink')
    if (i >= count) return clearInterval(blinker)
    labels.eq(i).addClass('blink')
  }, BLINK_MS)
}

module.exports = { build, load }
