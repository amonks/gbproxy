var UI = function () {
  var API = {}

  API.alert = function (res, alert, level) {
    res.redirect(process.env.CLIENT + '?alert=' + encodeURIComponent(alert) + '&alert_level=' + level)
  }

  return API
}
module.exports = new UI()
