// pages/alumnicard/alumnicard.js
Page({
  data: {
    hasProfile: false,
    profile: null,
  },

  onLoad() {
    this.loadProfile();
  },

  onShow() {
    this.loadProfile();
  },

  async loadProfile() {
    if (!wx.cloud) {
      this.setData({ hasProfile: false, profile: null });
      return;
    }
    try {
      const res = await wx.cloud.callFunction({ name: 'getMyProfile' });
      const result = res.result;
      this.setData({
        hasProfile: !!(result && result.hasProfile),
        profile: result && result.profile ? result.profile : null,
      });
    } catch (e) {
      console.error('getMyProfile fail', e);
      this.setData({ hasProfile: false, profile: null });
    }
  },
});
