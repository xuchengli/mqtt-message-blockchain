require('dotenv').config()
const path = require('path')
const Koa = require('koa')
const consola = require('consola')
const sleep = require('sleep-promise')
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
  const client = await helper.getClientForOrg()

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
}

start().then(() => {
  init()
})
