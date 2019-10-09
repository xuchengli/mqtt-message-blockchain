const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')
const consola = require('consola')
const hfc = require('fabric-client')

class Helper {
  async getClientForOrg (username) {
    try {
      const config = yaml.safeLoad(fs.readFileSync(path.join(__dirname, '../artifacts/network-config.yaml'), 'utf8'))
      config.orderers['orderer.example.com'].url = `grpc://${process.env.FABRIC_ORDERER_HOST}:7050`
      config.peers['peer0.org1.example.com'].url = `grpc://${process.env.FABRIC_PEER_HOST}:7051`
      config.peers['peer0.org1.example.com'].eventUrl = `grpc://${process.env.FABRIC_PEER_HOST}:7053`
      config.certificateAuthorities['ca-org1'].url = `http://${process.env.FABRIC_CA_HOST}:7054`

      const client = hfc.loadFromConfig(config)
      await client.initCredentialStores()

      if (username) {
        const user = await client.getUserContext(username, true)
        if (!user) {
          throw new Error(`User was not found: ${username}`)
        }
      }
      return client
    } catch (e) {
      throw new Error(e.toString())
    }
  }
  async getRegisteredUser (username) {
    try {
      const client = await this.getClientForOrg()

      const clientConfig = client.getClientConfig()
      let user = await client.getUserContext(username, true)

      if (!user || !user.isEnrolled()) {
        const caClient = client.getCertificateAuthority()
        const registrar = caClient.getRegistrar()
        if (!registrar || !registrar.length) {
          throw new Error('Registrar was not found.')
        }
        const adminUserObj = await client.setUserContext({
          username: registrar[0].enrollId,
          password: registrar[0].enrollSecret
        })

        const secret = await caClient.register({
          enrollmentID: username,
          affiliation: clientConfig.organization
        }, adminUserObj)

        consola.info('Successfully got the secret for user %s', username)

        user = await client.setUserContext({
          username,
          password: secret
        })

        consola.info('Successfully enrolled username %s and setUserContext on the client object', username)
      }
      if (user && user.isEnrolled) {
        return {
          success: true,
          secret: user._enrollmentSecret,
          message: username + ' enrolled Successfully'
        }
      } else {
        throw new Error('User was not enrolled')
      }
    } catch (e) {
      throw new Error(e.toString())
    }
  }
}
module.exports = Helper
