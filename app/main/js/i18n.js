/**
 * Translations. Keys are the English strings; `{{name}}` placeholders are
 * filled from the `vars` object passed to `t()` / `apply()`.
 */
const translations = {
  en: require('../i18n/Nook_English.json'),
  es: require('../i18n/Nook_Spanish.json'),
  de: require('../i18n/Nook_German.json'),
  it: require('../i18n/Nook_Italian.json'),
  fr: require('../i18n/Nook_French.json'),
  cn: require('../i18n/Nook_Chinese.json')
}

/** BCP 47 tags used for date and number formatting. */
const LOCALES = { en: 'en-US', es: 'es-ES', de: 'de-DE', it: 'it-IT', fr: 'fr-FR', cn: 'zh-CN' }

let language = 'en'
const vars = {}

const fill = (text, extra) => text.replace(/\{\{(\w+)\}\}/g, (match, name) => {
  if (extra && extra[name] !== undefined) return extra[name]
  if (vars[name] !== undefined) return vars[name]
  return match
})

const t = (key, extra) => {
  let text = translations[language] && translations[language][key]
  if (text === undefined) text = translations.en[key]
  if (text === undefined) {
    console.warn(`translation missing for "${key}"`)
    text = key
  }
  return fill(text, extra)
}

/** Re-renders every element carrying a data-i18n* attribute under `root`. */
const apply = (root = document.body) => {
  const $ = window.jQuery
  $(root).find('[data-i18n-title]').each((i, e) => {
    $(e).attr('title', t($(e).attr('data-i18n-title')))
  })
  $(root).find('[data-i18n]').each((i, e) => {
    $(e).html(t($(e).attr('data-i18n')))
  })
}

const setLanguage = lang => {
  language = translations[lang] ? lang : 'en'
  apply()
}

/** Updates a placeholder value and re-renders the elements that use it. */
const setVar = (name, value) => {
  vars[name] = value
  window.jQuery(`[data-i18n*="{{${name}}}"]`).each((i, e) => {
    window.jQuery(e).html(t(window.jQuery(e).attr('data-i18n')))
  })
}

const getVar = name => vars[name]
const getLanguage = () => language
const getLocale = () => LOCALES[language] || 'en-US'

module.exports = { t, apply, setLanguage, setVar, getVar, getLanguage, getLocale }
