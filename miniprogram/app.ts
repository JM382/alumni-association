// app.ts
App<IAppOption>({
  globalData: {
    userNickName: '',
    servicesInitialTab: '' as string | undefined,
  },
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云开发能力')
    } else {
      wx.cloud.init({
        env: 'cloud1-7g1x07md7360212c',
        traceUser: true,
      })
    }
    const saved = wx.getStorageSync('userNickName')
    if (saved) this.globalData.userNickName = saved

    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)
  },
})