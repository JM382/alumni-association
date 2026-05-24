// pages/profile/profile.ts
const app = getApp<IAppOption>()

Page({
  data: {
    userNickName: '',
    avatarUrl: '',
    hasProfile: false,
    profile: null as {
      nickName?: string
      alumniCardNo?: string
      department?: string
      enrollYear?: string
    } | null,
  },

  onLoad() {
    this.syncUserInfo()
    this.loadProfile()
  },

  onShow() {
    this.syncUserInfo()
    this.loadProfile()
  },

  syncUserInfo() {
    const nick = app.globalData.userNickName || wx.getStorageSync('userNickName') || ''
    const avatar = wx.getStorageSync('userAvatarUrl') || ''
    this.setData({ userNickName: nick, avatarUrl: avatar })
  },

  async loadProfile() {
    if (!wx.cloud) {
      this.setData({ hasProfile: false, profile: null })
      return
    }
    try {
      const res = await wx.cloud.callFunction({ name: 'getMyProfile' })
      const result = res.result as { hasProfile?: boolean; profile?: any }
      const cloudProfile = result?.profile || null
      // 本地缓存的资料（用户刚提交时一定有）
      const localProfile = {
        alumniCardNo: wx.getStorageSync('alumniCardNo') || '',
        enrollYear: wx.getStorageSync('enrollYear') || '',
        department: wx.getStorageSync('department') || '',
        phone: wx.getStorageSync('phone') || '',
        email: wx.getStorageSync('email') || '',
      }
      const p = { ...localProfile, ...(cloudProfile || {}) }
      const completedByData =
        !!(
          p.alumniCardNo ||
          p.department ||
          p.enrollYear ||
          p.phone ||
          p.email
        )
      const completedFlag = !!wx.getStorageSync('profileCompleted')
      const completed = completedByData || completedFlag
      this.setData({
        hasProfile: completed,
        profile: p,
      })
    } catch (e) {
      console.error('getMyProfile fail', e)
      this.setData({ hasProfile: false, profile: null })
    }
  },

  async onEditProfile() {
    try {
      const profile = await wx.getUserProfile({ desc: '用于完善校友资料' })
      const app = getApp<IAppOption>()
      app.globalData.pendingRegister = {
        nickName: profile.userInfo.nickName,
        avatarUrl: profile.userInfo.avatarUrl,
      }
      if (profile.userInfo.avatarUrl) wx.setStorageSync('userAvatarUrl', profile.userInfo.avatarUrl)
      wx.navigateTo({ url: '/pages/register/register' })
    } catch (e) {
      if ((e as any).errMsg?.includes('cancel')) return
      wx.showToast({ title: '需要授权后才能修改资料', icon: 'none' })
    }
  },

  onLogout() {
    wx.showModal({
      title: '提示',
      content: '确定退出登录吗？',
      success: (res) => {
        if (!res.confirm) return
        app.globalData.userNickName = ''
        app.globalData.pendingRegister = undefined
        wx.removeStorageSync('userNickName')
        wx.removeStorageSync('userAvatarUrl')
        wx.showToast({ title: '已退出登录', icon: 'none' })
        setTimeout(() => {
          wx.switchTab({ url: '/pages/home/home' })
        }, 500)
      },
    })
  },
})
