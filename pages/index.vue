<template>
  <!-- eslint-disable vue/html-indent vue/html-self-closing -->
  <div class="container">
    <Row :gutter="16">
      <Col span="12">
        <Card>
          <p slot="title">
            MQTT消息
          </p>
          <Table :columns="mqttTableColumns" :data="mqttMessages" />
        </Card>
      </Col>
      <Col span="12">
        <Card>
          <p slot="title">
            区块链信息
          </p>
          <Table :columns="blockTableColumns" :data="blockInfo" />
        </Card>
      </Col>
    </Row>
  </div>
</template>

<script>
import socket from '~/plugins/socket.io'

export default {
  data () {
    return {
      mqttTableColumns: [
        {
          title: 'ID',
          key: 'id'
        },
        {
          title: 'SN',
          key: 'sn'
        },
        {
          title: 'Time',
          key: 'time'
        },
        {
          title: 'Device ID',
          key: 'deviceId'
        },
        {
          title: 'Opened',
          key: 'opened'
        },
        {
          title: 'Code Type',
          key: 'codeType'
        }
      ],
      mqttMessages: [],
      blockTableColumns: [
        {
          title: 'Block Number',
          key: 'number',
          width: 150
        },
        {
          title: 'Transaction',
          key: 'txId',
          render: (h, params) => {
            const li = params.row.txId.map(tx => h('li', tx))
            return h('ol', li)
          }
        }
      ],
      blocks: []
    }
  },
  computed: {
    blockInfo () {
      return this.blocks.map((block) => {
        const { number, transaction } = block
        return {
          number,
          txId: transaction.map(tx => tx.txId)
        }
      })
    }
  },
  beforeMount () {
    socket.on('mqtt message', (message) => {
      this.mqttMessages.unshift(message)
    })
    socket.on('block info', (info) => {
      this.blocks.unshift(info)
    })
  }
}
</script>

<style>
.container {
  margin: 10px;
}
</style>
