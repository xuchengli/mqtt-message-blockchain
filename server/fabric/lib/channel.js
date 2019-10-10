const fs = require('fs')
const consola = require('consola')

class Channel {
  constructor (client) {
    this.client = client
  }
  async queryBlockByTxID (txId) {
    try {
      const channel = this.client.getChannel()
      return await channel.queryBlockByTxID(txId, null, true)
    } catch (err) {
      throw new Error(err.toString())
    }
  }
  async create (channelName, channelTx) {
    try {
      const envelope = fs.readFileSync(channelTx)
      const channelConfig = this.client.extractChannelConfig(envelope)
      const signature = this.client.signChannelConfig(channelConfig)

      const request = {
        config: channelConfig,
        signatures: [signature],
        name: channelName,
        txId: this.client.newTransactionID(true)
      }
      const response = await this.client.createChannel(request)

      consola.info('Create channel response: %j', response)

      if (response && response.status === 'SUCCESS') {
        return {
          success: true,
          message: `Channel ${channelName} created Successfully`
        }
      } else {
        throw new Error(`Failed to create the channel ${channelName}`)
      }
    } catch (err) {
      throw new Error(err.toString())
    }
  }
  async join (channelName) {
    try {
      const peers = this.client.getPeersForOrg()
      const targets = peers.map(peer => peer.getName())

      const channel = this.client.getChannel(channelName)
      const genesisBlock = await channel.getGenesisBlock({
        txId: this.client.newTransactionID(true)
      })
      const request = {
        targets,
        txId: this.client.newTransactionID(true),
        block: genesisBlock
      }
      const response = await channel.joinChannel(request)

      consola.info('Join Channel R E S P O N S E : %j', response)

      const result = response.map((res) => {
        return res.response && res.response.status === 200
      }).every(res => res)
      if (result) {
        return {
          success: true,
          message: `Successfully joined to the channel ${channelName}`
        }
      } else {
        throw new Error(`Failed to join the channel ${channelName}`)
      }
    } catch (err) {
      throw new Error(err.toString())
    }
  }
  async list () {
    try {
      const channelNames = new Set()
      const peers = this.client.getPeersForOrg()
      for (const peer of peers) {
        const response = await this.client.queryChannels(peer, true)
        response.channels.map(res => res.channel_id).forEach(channel => channelNames.add(channel))
      }
      return [...channelNames]
    } catch (err) {
      throw new Error(err.toString())
    }
  }
  getEventHub () {
    try {
      const channel = this.client.getChannel()
      const peer = this.client.getPeersForOrg()[0]

      return channel.newChannelEventHub(peer)
    } catch (err) {
      throw new Error(err.toString())
    }
  }
}
module.exports = Channel
