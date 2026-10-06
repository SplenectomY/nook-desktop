/**
 * The visible Nook window. Wires the controls to the player over IPC and
 * reacts to the player's events.
 */
const ipc = require('electron').ipcRenderer
const $ = window.jQuery
const i18n = require('./js/i18n')
const pages = require('./js/pages')
const analytics = require('./js/analytics')
const weatherUi = require('./js/weather-ui')
const kkScene = require('./js/kk-scene')
const tuneEditor = require('./js/tune-editor')
const games = require('../shared/games')
const changelog = require('../shared/release-log.json')

const toPlayer = (...args) => ipc.send('toPlayer', args)

let nanobar
let paused = false
let lastWeatherError = null

const setPaused = state => {
  paused = state
  const btn = $('#pause')
  btn.toggleClass('paused', state)
  btn.text(state ? '\uf04b' : '\uf04c')
  btn.attr('title', i18n.t(btn.attr(state ? 'data-i18n-title-alt' : 'data-i18n-title')))
}

/** Briefly disables the settings so a toggle cannot be hammered mid-switch. */
const cooldown = () => {
  const inputs = $('.settings').find('input, button, select')
  inputs.attr('disabled', true)
  setTimeout(() => inputs.removeAttr('disabled'), 300)
}

const flash = button => {
  button.text(i18n.t(button.attr('data-i18n-alt')))
  setTimeout(() => button.text(i18n.t(button.attr('data-i18n'))), 1000)
}

const showError = key => {
  $('.error div').text(i18n.t(key)).parent().addClass('show-error')
  setTimeout(() => $('.error').removeClass('show-error'), 4000)
}

const renderChangelog = () => {
  $('.changelog .log').html(Object.entries(changelog).map(([version, notes]) =>
    `<p>${version}</p><ul>${notes.map(n => `<li>${n}</li>`).join('')}</ul>`
  ).join(''))
}

const renderPlaylist = () => {
  $('.kk-customize .playlist').html(games.kkSongs.map(song =>
    `<label><input type="checkbox" class="kkSong" data-title="${song}" />${song}</label>`
  ).join(''))
}

const renderNowPlaying = playing => {
  if (!playing) return $('#nowPlaying').addClass('hidden')
  const { game, track } = playing
  const label = game === games.KK_GAME ? i18n.t('K.K. Slider') : $(`#gameSelect option[value="${game}"]`).text()
  $('#nowPlaying').removeClass('hidden')
  $('#nowPlaying .np-game').text(label || games.humanGameName(game))
  $('#nowPlaying .np-track').text(track)
}

/** Fills the controls from the player's saved settings. */
const hydrate = config => {
  i18n.setVar('offlineFiles', config.offlineFiles)
  i18n.setVar('offlineKKFiles', config.offlineKKFiles)
  i18n.setVar('totalFiles', config.totalFiles)
  i18n.setVar('totalKKFiles', config.totalKKFiles)
  i18n.setLanguage(config.lang)

  $('#music').val(config.soundVol)
  $('#rain').val(config.rainVol)
  $('#grandFather').prop('checked', config.grandFather)
  $('#gameRain').prop('checked', config.gameRain)
  $('#peacefulRain').prop('checked', config.peacefulRain)
  $('#gameSelect').val(config.game)
  $('#langSelect').val(config.lang)
  $('#townTune').prop('checked', config.tuneEnabled)
  $('#preferNoDownload').prop('checked', config.preferNoDownload)
  $('#kkSaturday').prop('checked', config.kkSaturday)
  $('#openOnStartup').prop('checked', config.openOnStartup)
  $('#useRealtimeWeather').prop('checked', config.useRealtimeWeather)
  $('#weatherApiCode').val(config.weatherApiCode)
  $('.kk-customize input').prop('checked', false)
  config.kkEnabled.forEach(song => $(`.kk-customize input[data-title="${song}"]`).prop('checked', true))
  tuneEditor.load(config.tune)
  setPaused(config.paused)
  weatherUi.configure({ enabled: config.useRealtimeWeather, hasKey: Boolean(config.weatherApiCode), unit: config.tempUnit })

  $('.container').addClass('visible')
  if (config.showChangelog) pages.show('changelog')
}

const bindControls = () => {
  $('#close').on('click', () => ipc.send('min'))
  $('#exit').on('click', () => ipc.send('close'))
  $('#pause').on('click', () => {
    setPaused(!paused)
    toPlayer('paused', paused)
  })
  $('#supportme').on('click', () => ipc.send('openExternal', 'patreon'))
  $('#openGithub').on('click', () => ipc.send('openExternal', 'github'))
  $('#getApiKey').on('click', e => {
    e.preventDefault()
    ipc.send('openExternal', 'weatherapi')
  })

  $('#music').on('change', e => toPlayer('musicVol', e.target.value))
  $('#rain').on('change', e => toPlayer('rainVol', e.target.value))
  $('#gameSelect').on('change', e => toPlayer('game', e.target.value))

  // simple on/off settings: element id -> player command
  const toggles = {
    grandFather: 'grandFather',
    gameRain: 'gameRain',
    peacefulRain: 'peacefulRain',
    townTune: 'tuneEnabled',
    preferNoDownload: 'preferNoDownload',
    kkSaturday: 'kkSaturday',
    openOnStartup: 'openOnStartup',
    useRealtimeWeather: 'useRealtimeWeather'
  }
  Object.entries(toggles).forEach(([id, command]) => {
    $(`#${id}`).on('change', e => {
      toPlayer(command, e.target.checked)
      cooldown()
    })
  })
  // the two rain flavours are exclusive
  $('#gameRain').on('change', () => $('#peacefulRain').prop('checked', false))
  $('#peacefulRain').on('change', () => $('#gameRain').prop('checked', false))
  $('#useRealtimeWeather').on('change', e => {
    weatherUi.configure({ enabled: e.target.checked })
  })
  $('#weatherApiCode').on('change', e => {
    toPlayer('weatherApiCode', e.target.value)
    weatherUi.configure({ hasKey: Boolean(e.target.value.trim()) })
  })

  $('#langSelect').on('change', e => {
    i18n.setLanguage(e.target.value)
    weatherUi.render()
    toPlayer('lang', e.target.value)
  })

  $('#clearSettings').on('click', () => {
    const ok = window.confirm(`${i18n.t('Are you sure?')}\n\n${i18n.t('Click "OK" to proceed and delete all local music files and user settings.')}`)
    if (ok) ipc.send('clearSettings')
  })

  $('.settings .download').on('click', e => {
    const button = $(e.currentTarget)
    button.text(i18n.t(button.attr('data-i18n-alt')))
    $('.settings .download').attr('disabled', 'true')
    toPlayer(button.attr('id'))
    cooldown()
  })

  $('#save_kk').on('click', () => {
    const list = $('.kk-customize input:checked').map((i, e) => $(e).attr('data-title')).get()
    toPlayer('kkEnabled', list)
    flash($('#save_kk'))
  })
  $('#check_kk').on('click', () => $('.kk-customize input').prop('checked', true))
  $('#uncheck_kk').on('click', () => $('.kk-customize input').prop('checked', false))
  $('#live_kk').on('click', () => {
    $('.kk-customize input').each((i, e) => $(e).prop('checked', !$(e).attr('data-title').includes('(Radio)')))
  })
  $('#radio_kk').on('click', () => {
    $('.kk-customize input').each((i, e) => $(e).prop('checked', $(e).attr('data-title').includes('(Radio)')))
  })

  $('#skipKK').on('click', () => toPlayer('skipKK'))

  $('.unit-toggle button').on('click', e => {
    const unit = $(e.currentTarget).attr('data-unit')
    weatherUi.configure({ unit })
    toPlayer('tempUnit', unit)
  })
  $('#weatherRefresh').on('click', () => {
    $('#weatherRefresh').addClass('spinning')
    toPlayer('refreshWeather')
    setTimeout(() => $('#weatherRefresh').removeClass('spinning'), 1500)
  })
}

const handlePlayerEvent = (event, [command, payload]) => {
  const handlers = {
    configs: () => {
      hydrate(payload)
      nanobar = new window.Nanobar({ classname: 'nanobar', id: 'nanobar', target: $('.header')[0] })
      nanobar.go(0)
    },
    bar: () => nanobar && nanobar.go(+payload),
    error: () => {
      if (payload === 'failedToDownload' && nanobar) nanobar.go(100)
      showError(payload)
    },
    downloadDone: () => {
      const name = payload === 'kk' ? 'offlineKKFiles' : 'offlineFiles'
      i18n.setVar(name, (i18n.getVar(name) || 0) + 1)
    },
    downloadRemoved: () => {
      const name = payload === 'kk' ? 'offlineKKFiles' : 'offlineFiles'
      i18n.setVar(name, Math.max(0, (i18n.getVar(name) || 0) - 1))
    },
    downloadDoneAll: () => {
      $('.settings .download').removeAttr('disabled').each((i, e) => $(e).text(i18n.t($(e).attr('data-i18n'))))
    },
    patreon: () => {
      Object.entries(payload || {}).forEach(([tier, names]) => {
        $(`.${tier} ul`).html(names.map(n => `<li title="${n}">${n}</li>`).join(''))
      })
    },
    pause: () => setPaused(true),
    nowPlaying: () => {
      renderNowPlaying(payload)
      kkScene.update(payload)
    },
    weather: () => {
      lastWeatherError = null
      weatherUi.setReport(payload)
    },
    weatherError: () => {
      weatherUi.setError(payload)
      // only toast a problem once, not on every background refresh
      if (payload !== lastWeatherError) showError(payload)
      lastWeatherError = payload
    }
  }
  const handler = handlers[command]
  if (handler) handler()
}

$(() => {
  renderChangelog()
  renderPlaylist()
  tuneEditor.build()
  pages.init()
  pages.onShow(analytics.logVisit)
  bindControls()
  i18n.apply()
  ipc.on('toWindow', handlePlayerEvent)
})
