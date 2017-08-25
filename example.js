var StripeDat = require('.')

var sDat = StripeDat('stripe-key', 'data', {
  filter: function (charge) {
    if (charge.metadata && charge.metadata.donation) return true
    return charge.description.indexOf('Donation to') > -1
  },
  fee: {
    pct: 0.022, // nonprofit fees =)
    amt: 0.3
  },
  anonymize: true
})

// put all charges into dat
sDat.getCharges(new Date('1/1/2017'), function (err) {
  if (err) throw err
  console.log('done')

  // manually add a charge
  sDat.addCharge({
    'id': 'asdfasdf', 'amount': 10000000, 'created': 1499366591, 'currency': 'usd'
  }, function (err) {
    if (err) throw err
    console.log('added charge')
  })
})
