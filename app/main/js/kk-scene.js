/** Shows K.K. strumming on the home page while his music is playing. */
const $ = window.jQuery
const games = require('../../shared/games')

const show = song => {
  $('#kkScene').removeClass('hidden').find('.kk-song').text(song)
}

const hide = () => {
  $('#kkScene').addClass('hidden')
}

/** Reacts to the player's now-playing updates. */
const update = playing => {
  if (playing && playing.game === games.KK_GAME) show(playing.track)
  else hide()
}

module.exports = { show, hide, update }
