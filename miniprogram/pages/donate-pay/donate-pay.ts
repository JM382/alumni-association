// pages/donate-pay/donate-pay.ts
Page({
  data: {
    projectId: '',
    projectName: '',
    projectDesc: '',
    amountMode: 'preset' as 'preset' | 'custom',
    selectedFen: 5000,
    customYuanStr: '50',
    paying: false,
    loadError: '',
  },

  onLoad(options: { id?: string }) {
    const raw = options?.id || ''
    const id = raw ? decodeURIComponent(raw) : ''
    if (!id) {
      this.setData({ loadError: '缺少项目参数，请从捐赠通道进入' })
      return
    }
    this.setData({ projectId: id })
    this.loadProject(id)
  },

  async loadProject(id: string) {
    if (!wx.cloud) {
      this.setData({ loadError: '当前环境不支持云开发' })
      return
    }
    try {
      const res = await wx.cloud.callFunction({ name: 'getDonationProjects' })
      const result = res.result as { list?: Array<{ id: string; name: string; desc: string }> }
      const list = result?.list || []
      const p = list.find((x) => x.id === id)
      if (!p) {
        this.setData({ loadError: '未找到该筹款项目' })
        return
      }
      this.setData({
        projectName: p.name,
        projectDesc: p.desc || '感谢您的爱心支持。',
        loadError: '',
      })
    } catch (e) {
      console.error('loadProject', e)
      this.setData({ loadError: '项目信息加载失败' })
    }
  },

  onAmountPreset(e: WechatMiniprogram.TouchEvent) {
    const fen = Number(e.currentTarget.dataset.fen)
    if (!Number.isFinite(fen)) return
    this.setData({ amountMode: 'preset', selectedFen: fen })
  },

  onAmountCustom() {
    const fen = this.data.selectedFen
    this.setData({
      amountMode: 'custom',
      customYuanStr: (fen / 100).toFixed(2),
    })
  },

  onCustomYuanChange(e: WechatMiniprogram.CustomEvent) {
    this.setData({ customYuanStr: (e.detail as { value?: string }).value ?? '' })
  },

  parseAmountFen(): number | null {
    if (this.data.amountMode === 'custom') {
      const yuan = parseFloat(String(this.data.customYuanStr ?? '').trim())
      if (!Number.isFinite(yuan) || yuan < 0.1) return null
      let fen = Math.round(yuan * 100)
      if (fen < 10) fen = 10
      if (fen > 5000000) fen = 5000000
      return fen
    }
    const fen = this.data.selectedFen
    return Number.isFinite(fen) && fen >= 10 ? fen : 5000
  },

  async onPay() {
    const { projectId, projectName } = this.data
    if (!projectId) return
    const amountFen = this.parseAmountFen()
    if (amountFen === null) {
      wx.showToast({ title: '请输入有效金额（元）', icon: 'none' })
      return
    }
    if (!wx.cloud) {
      wx.showToast({ title: '当前环境不支持', icon: 'none' })
      return
    }

    this.setData({ paying: true })
    try {
      const createRes = await wx.cloud.callFunction({
        name: 'createDonateOrder',
        data: { projectId, projectName: projectName || '爱心捐赠', amountFen },
      })
      const result = createRes.result as {
        success?: boolean
        errMsg?: string
        detail?: { code?: string; message?: string }
        outTradeNo?: string
        payParams?: {
          timeStamp: string
          nonceStr: string
          package: string
          signType: 'RSA'
          paySign: string
        }
      }
      if (!result?.success || !result.payParams || !result.outTradeNo) {
        let msg = result?.errMsg || '创建支付单失败'
        if (!result?.errMsg && result?.detail?.message) {
          msg = `微信下单失败：${result.detail.code ? `${result.detail.code}：` : ''}${result.detail.message}`
        }
        if (msg.length > 18) {
          wx.showModal({ title: '无法发起支付', content: msg.length > 800 ? `${msg.slice(0, 800)}…` : msg, showCancel: false })
        } else {
          wx.showToast({ title: msg, icon: 'none', duration: 3500 })
        }
        return
      }

      await wx.requestPayment(result.payParams)

      const confirmRes = await wx.cloud.callFunction({
        name: 'confirmDonateOrder',
        data: { outTradeNo: result.outTradeNo },
      })
      const confirm = confirmRes.result as { success?: boolean; paid?: boolean; tradeState?: string; errMsg?: string }
      if (confirm?.success && confirm?.paid) {
        wx.showToast({ title: '捐赠成功', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 500)
      } else {
        wx.showToast({ title: confirm?.errMsg || `支付状态：${confirm?.tradeState || '未知'}`, icon: 'none' })
      }
    } catch (e: unknown) {
      const err = e as { errMsg?: string }
      if (err?.errMsg?.includes('cancel')) {
        wx.showToast({ title: '已取消支付', icon: 'none' })
      } else {
        console.error('onPay', e)
        wx.showToast({ title: '支付失败，请重试', icon: 'none' })
      }
    } finally {
      this.setData({ paying: false })
    }
  },
})
