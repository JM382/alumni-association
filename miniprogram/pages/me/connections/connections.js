// pages/me/connections/connections.js
Page({
  data: {
    loading: false,
    list: [],
    mySchool: '',
    myMajor: '',
  },

  onLoad() {
    this.loadMyInfoAndSearch();
  },

  loadMyInfoAndSearch() {
    this.setData({ loading: true });
    wx.cloud
      .callFunction({
        name: 'getUserInfo',
      })
      .then((res) => {
        const data = (res.result && res.result.data) || {};
        const mySchool = data.schoolName || '';
        const myMajor = data.major || '';
        this.setData({ mySchool, myMajor });
        return this.fetchConnections(mySchool, myMajor);
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  fetchConnections(schoolName, major) {
    return wx.cloud
      .callFunction({
        name: 'searchAlumni',
        data: {
          schoolName,
          major,
          page: 1,
          pageSize: 50,
        },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '加载失败', icon: 'none' });
          return;
        }
        this.setData({ list: result.list || [] });
      });
  },

  onTapUser(e) {
    const userId = e.currentTarget.dataset.userId;
    if (!userId) return;
    wx.navigateTo({
      url: `/pages/me/user-profile/user-profile?userId=${userId}`,
    });
  },

  onStartChat(e) {
    const userId = e.currentTarget.dataset.userId;
    if (!userId) return;
    wx.cloud
      .callFunction({
        name: 'social',
        data: {
          action: 'ensureConversation',
          targetUserId: userId,
        },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '发起失败', icon: 'none' });
          return;
        }
        wx.showToast({ title: '会话已创建，聊天稍后接入', icon: 'none' });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '发起失败', icon: 'none' });
      });
  },
});

