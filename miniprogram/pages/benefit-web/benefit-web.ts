// pages/benefit-web/benefit-web.ts
Page({
  data: {
    safeUrl: '',
    hint: '加载中…',
  },

  onLoad(options: { url?: string; title?: string }) {
    const rawTitle = options.title ? decodeURIComponent(options.title) : ''
    const rawUrl = options.url ? decodeURIComponent(options.url) : ''
    if (rawTitle) {
      wx.setNavigationBarTitle({ title: rawTitle.length > 14 ? `${rawTitle.slice(0, 14)}…` : rawTitle })
    }
    const trimmed = rawUrl.trim()
    if (!trimmed || !/^https:\/\//i.test(trimmed)) {
      this.setData({
        safeUrl: '',
        hint: '链接无效或未使用 https。请在 services.ts 中为该项配置 useUrl，并在微信公众平台配置业务域名。',
      })
      return
    }
    this.setData({ safeUrl: trimmed, hint: '' })
  },
})
