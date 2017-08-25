var assert = require('assert')
var hypercore = require('hypercore')
var ChargeList = require('stripe-charge-list')
var Charges = require('stripe-charge-list/charges')
var pump = require('pump')
var pick = require('lodash.pick')
var discovery = require('hyperdiscovery')
var debug = require('debug')('stripe-dat')

module.exports = StripeDat

function StripeDat (key, storage, opts) {
  if (!(this instanceof StripeDat)) return new StripeDat(key, storage, opts)
  assert.ok(key, 'stripe-dat: stripe key required')
  assert.ok(storage,'stripe-dat: dat storage path required')
  if (!opts) opts = {}
  var self = this

  self.options = opts
  self.chargesAPI = ChargeList(key, opts)
  self.feed = hypercore(storage, {valueEncoding: 'json'})

  if (self.options.discovery) {
    self.feed.ready(function () {
      debug('discovery', self.feed.key.toString('hex'))
      discovery(self.feed)
    })
  }
}

StripeDat.prototype.getCharges = function (start, cb) {
  if (!(start instanceof Date)) throw new Error('Start must be a date.')

  var self = this
  self.feed.ready(function () {
    if (!self.feed.length) return getCharges()
    self.feed.get(self.feed.length - 1, function (err, data) {
      if (err) return cb(err)
      getCharges(data.id)
    })
  })

  function getCharges (id) {
    // TODO: read old charges to check for last ID
    // TODO: filter and remove identify info before write
    var chargeOpts = {startingAfter: id}
    self.chargesAPI.get(start, new Date(), chargeOpts, function (err, charges) {
      if (err) return cb(err)
      self._processCharges(charges, cb)
    })
  }
}

StripeDat.prototype.addCharge = function (charge, cb) {
  this._processCharges([charge], cb)
}

StripeDat.prototype._processCharges = function (charges, cb) {
  // only keep successful non-refunded
  var self = this
  if (Array.isArray(charges)) charges = Charges(charges, self.options)
  charges = charges.paid(true).refunded(false)
  if (self.options.filter) {
    charges = charges.filter(self.options.filter)
  }
  if (!charges.count()) return cb() // already up to date

  var pending = charges.count()
  charges.list().map(function (charge) {
    if (self.options.anonymize) {
      // only keep keys we need
      charge = pick(charge, ['id', 'amount', 'created', 'currency'])
      charge.netAmount = charges._amount(charge) // subtract fees
    }
    // TODO: wait for all to cb
    self.feed.append(charge, function (err) {
      if (err) return cb(err)
      if (--pending) return
      cb(null, charges.list()) // returns non-anonymized
    })
  })
}
