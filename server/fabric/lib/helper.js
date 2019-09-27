const path = require('path')
const hfc = require('fabric-client')

class Helper {
  async getClientForOrg () {
    const client = hfc.loadFromConfig(path.join(__dirname, '../artifacts/network-config.yaml'))
    await client.initCredentialStores()
    return client
  }
}
module.exports = Helper
