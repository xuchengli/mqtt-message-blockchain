require('dotenv').config()
const path = require('path')
const fs = require('fs')
const Koa = require('koa')
const consola = require('consola')
const sleep = require('sleep-promise')
const mqtt = require('mqtt')
const protobuf = require('protobufjs')
const { Nuxt, Builder } = require('nuxt')

const app = new Koa()

// Import and Set Nuxt.js options
const config = require('../nuxt.config.js')
config.dev = app.env !== 'production'

const Helper = require('./fabric/lib/helper')
const Channel = require('./fabric/lib/channel')
const ChainCode = require('./fabric/lib/chaincode')

async function start () {
  // Instantiate nuxt.js
  const nuxt = new Nuxt(config)

  const {
    host = process.env.HOST || '127.0.0.1',
    port = process.env.PORT || 3000
  } = nuxt.options.server

  // Build in development
  if (config.dev) {
    const builder = new Builder(nuxt)
    await builder.build()
  } else {
    await nuxt.ready()
  }

  app.use((ctx) => {
    ctx.status = 200
    ctx.respond = false // Bypass Koa's built-in response handling
    ctx.req.ctx = ctx // This might be useful later on, e.g. in nuxtServerInit or with nuxt-stash
    nuxt.render(ctx.req, ctx.res)
  })

  app.listen(port, host)
  consola.ready({
    message: `Server listening on http://${host}:${port}`,
    badge: true
  })
}

async function init () {
  process.env.GOPATH = path.join(__dirname, './fabric/artifacts')

  const helper = new Helper()

  const user = await helper.getRegisteredUser('guest')
  consola.info('Register user response: %j', user)

  const client = await helper.getClientForOrg('guest')

  const channel = new Channel(client)
  const chaincode = new ChainCode(client)

  const channelList = await channel.list()
  if (channelList.length === 0) {
    const tx = path.join(__dirname, './fabric/artifacts/config/channel.tx')
    const createdChannel = await channel.create('mychannel', tx)
    if (!createdChannel.success) {
      throw new Error('Failed to create the mychannel.')
    }

    await sleep(5000)
    await channel.join('mychannel')

    const installed = await chaincode.install('github.com/mqtt', 'mqtt', '1.0')
    if (!installed.success) {
      throw new Error('Failed to install the chaincode.')
    }

    const instantiated = await chaincode.instantiate('mychannel', 'mqtt', '1.0', 'init', [])
    if (!instantiated.success) {
      throw new Error('Failed to instantiate the chaincode.')
    }
    channelList.push('mychannel')
  }
  consola.success('Channel list: ', channelList)

  // connect to peer's event service, and register block listener
  const eventHub = channel.getEventHub()
  eventHub.registerBlockEvent((block) => {
    consola.info('===============')

    const { header: { number }, data: { data } } = block
    const blockInfo = {
      number,
      transaction: data.map((d) => {
        const { header: { channel_header: { 'tx_id': txId } }, data: { actions } } = d.payload
        const payload = actions.map((action) => {
          const { payload: { action: { proposal_response_payload: { extension: { response: { payload } } } } } } = action
          return payload
        })
        return {
          txId,
          payload
        }
      })
    }
    consola.info('%o', blockInfo)

    consola.info('===============')
  }, (err) => {
    consola.error('Failed to receive the block event :: %s', err)
    throw new Error(err.toString())
  }, { unregister: false, disconnect: false })
  eventHub.connect(true, (err, res) => {
    if (err) {
      consola.error('Failed to connect to peer event hub.', err)
      throw new Error(err.toString())
    }
    consola.success('Peer event hub connect successfully!')
  })

  // subscribe mqtt message
  const KEY = fs.readFileSync(path.join(__dirname, './mqtt/tls/client.key'))
  const CERT = fs.readFileSync(path.join(__dirname, './mqtt/tls/client.pem'))
  const TRUSTED_CA_LIST = fs.readFileSync(path.join(__dirname, './mqtt/tls/ca.pem'))

  const options = {
    port: 8883,
    host: 'emq.yfmen.com',
    key: KEY,
    cert: CERT,
    rejectUnauthorized: false,
    // The CA list will be used to determine if server is authorized
    ca: TRUSTED_CA_LIST,
    protocol: 'mqtts'
  }
  const mqttClient = mqtt.connect(options)
  mqttClient.on('connect', function () {
    consola.success('MQTT 连接成功>>>>')

    protobuf.load(path.join(__dirname, './mqtt/accessrecord.proto'), function (err, root) {
      if (err) {
        throw err
      }
      const AccessRecordMessage = root.lookupType('accessrecord.AccessRecord')

      mqttClient.subscribe('/d/r')
      mqttClient.on('message', function (topic, message) {
        // message is Buffer
        const decodedMsg = AccessRecordMessage.decode(message)
        const jsonMsg = JSON.parse(JSON.stringify(decodedMsg))

        const { id = '0', sn = '0', time = Date.now(), deviceId = 0, opened = false, codeType = 0 } = jsonMsg

        chaincode.invoke('mqtt', 'add', [ id, sn, time, deviceId.toString(), opened.toString(), codeType.toString() ])
      })
    })
  })
}

start().then(() => {
  init()
})
