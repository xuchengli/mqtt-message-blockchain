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
  const channelList = await channel.list()

  if (channelList.length === 0) {
    const tx = path.join(__dirname, './fabric/artifacts/config/channel.tx')
    const createdChannel = await channel.create('mychannel', tx)
    if (!createdChannel.success) {
      throw new Error('Failed to create the mychannel.')
    }

    await sleep(5000)
    await channel.join('mychannel')

    const chaincode = new ChainCode(client)
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
    consola.success('连接成功>>>>')

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

        consola.info(jsonMsg)
      })
    })
  })
}

start().then(() => {
  init()
})
