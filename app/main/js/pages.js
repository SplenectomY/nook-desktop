/**
 * Page navigation. Every element with a `data-page` attribute switches to
 * that page; the header shows a home button everywhere except on the home
 * page and a settings button there.
 */
const $ = window.jQuery
const listeners = []

const show = name => {
  $('.page').addClass('hidden')
  $(`.${name}.page`).removeClass('hidden')
  const atHome = name === 'home'
  $('#home').toggleClass('hidden', atHome)
  $('#settings').toggleClass('hidden', !atHome)
  $(atHome ? '#settings' : '#home').focus()
  listeners.forEach(fn => fn(name))
}

const onShow = fn => listeners.push(fn)

const init = () => {
  $(document).on('click', '[data-page]', e => show($(e.currentTarget).attr('data-page')))
}

module.exports = { show, onShow, init }
