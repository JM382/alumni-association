// pages/alumnicard/alumnicard.ts
Page({
  data: {
    hasProfile: false,
    profile: null as Record<string, unknown> | null,
  },

  onLoad() {
    this.loadProfile()
  },

  onShow() {
    this.loadProfile()
  },

  async loadProfile() {
    if (!wx.cloud) {
      this.setData({ hasProfile: false, profile: null })
      return
    }
    try {
      const res = await wx.cloud.callFunction({ name: 'getMyProfile' })
      const result = res.result as { hasProfile?: boolean; profile?: Record<string, unknown> }
      this.setData({
        hasProfile: !!result?.hasProfile,
        profile: result?.profile ?? null,
      })
    } catch (e) {
      console.error('getMyProfile fail', e)
      this.setData({ hasProfile: false, profile: null })
    }
  },
})
