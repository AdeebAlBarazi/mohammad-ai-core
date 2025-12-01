(function(global){
  var I18n = null;
  function getLang(){ try { return (global.Market && global.Market.I18n && global.Market.I18n.getLang()) || 'ar'; } catch(_) { return 'ar'; } }
  function getCurrencyCode(lang){ try { I18n = global.Market && global.Market.I18n; return I18n ? I18n.t('currency_code', lang) : 'SAR'; } catch(_) { return 'SAR'; } }
  function getCurrencySuffix(lang){ try { I18n = global.Market && global.Market.I18n; return I18n ? I18n.t('sar', lang) : 'SAR'; } catch(_) { return 'SAR'; } }
  function currency(val, lang){ var l = lang||getLang(); if (val==null) return currency(0, l); var code = getCurrencyCode(l); try { var locale = (l==='en'?'en-US':'ar-SA'); var nf = new Intl.NumberFormat(locale, { style:'currency', currency: code, minimumFractionDigits: 2 }); return nf.format(Number(val)); } catch(_) { return String(val) + ' ' + getCurrencySuffix(l); } }
  function number(val, lang){ var l = lang||getLang(); try { var locale = (l==='en'?'en-US':'ar-SA'); var nf = new Intl.NumberFormat(locale); return nf.format(Number(val||0)); } catch(_) { return String(val||0); } }
  global.Market = global.Market || {}; global.Market.Format = { currency: currency, number: number };
})(window);
