var GifQueue = function () {
  var API = {}

  var queue = []

  API.add = function (tweet, cb) {
    queue.push({id: tweet.id_str, cb: cb})
  }

  API.resolve = function (id) {
    for (var queued of queue) {
      if (id === queued.id) {
        queued.cb()
        queue.slice(queue.indexOf(queued), 1)
      }
    }
    return false
  }
  return API
}
module.exports = new GifQueue()
