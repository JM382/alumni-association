// pages/service-orders/service-orders.ts
Page({
  data: {
    list: [] as Array<{
      _id: string
      type: string
      data: Record<string, unknown>
      createdAt?: string
      _displayType?: string
      _displayTime?: string
    }>,
    loading: true,
  },

  onLoad() {
    this.loadList()
  },

  onShow() {
    this.loadList()
  },

  async loadList() {
    this.setData({ loading: true })
    if (!wx.cloud) {
      this.setData({ list: [], loading: false })
      return
    }
    try {
      const res = await wx.cloud.callFunction({ name: 'getMyServiceOrders' })
      const result = res.result as { list?: Array<{ _id: string; type: string; data: Record<string, unknown>; createdAt?: string }> }
      const raw = result?.list || []
      const list = raw.map((item) => {
        let _displayType = '其他服务'
        if (item.type === 'return_visit') _displayType = '返校预约'
        let _displayTime = ''
        const ct = item.createdAt as any
        if (ct) {
          const dateVal = typeof ct === 'object' && ct.$date ? ct.$date : ct
          const t = new Date(dateVal)
          if (!isNaN(t.getTime())) {
            _displayTime = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`
          }
        }
        return { ...item, _displayType, _displayTime }
      })
      this.setData({ list, loading: false })
    } catch (e) {
      console.error('getMyServiceOrders', e)
      this.setData({ list: [], loading: false })
    }
  },
})
