// pages/profile/profile.js
const app = getApp();

Page({
  data: {
    userNickName: '',
    avatarUrl: '',
  },

  onLoad() {
    this.syncUserInfo();
  },

  onShow() {
    this.syncUserInfo();
  },

  syncUserInfo() {
    const nick = app.globalData.userNickName || wx.getStorageSync('userNickName') || '';
    const avatar = wx.getStorageSync('userAvatarUrl') || '';
    this.setData({ userNickName: nick, avatarUrl: avatar });
  },

  async onEditProfile() {
    try {
      const profile = await wx.getUserProfile({ desc: '用于完善校友资料' });
      app.globalData.pendingRegister = {
        nickName: profile.userInfo.nickName,
        avatarUrl: profile.userInfo.avatarUrl,
      };
      if (profile.userInfo.avatarUrl) wx.setStorageSync('userAvatarUrl', profile.userInfo.avatarUrl);
      wx.navigateTo({ url: '/pages/register/register' });
    } catch (e) {
      if (e.errMsg && e.errMsg.includes('cancel')) return;
      wx.showToast({ title: '需要授权后才能修改资料', icon: 'none' });
    }
  },

  onLogout() {
    wx.showModal({
      title: '提示',
      content: '确定退出登录吗？',
      success: (res) => {
        if (!res.confirm) return;
        app.globalData.userNickName = '';
        app.globalData.pendingRegister = undefined;
        wx.removeStorageSync('userNickName');
        wx.removeStorageSync('userAvatarUrl');
        wx.removeStorageSync('profileCompleted');
        wx.showToast({ title: '已退出登录', icon: 'none' });
        setTimeout(() => {
          wx.switchTab({ url: '/pages/home/home' });
        }, 500);
      },
    });
  },
});
