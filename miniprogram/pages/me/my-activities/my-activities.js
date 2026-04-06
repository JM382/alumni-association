// pages/me/my-activities/my-activities.js
Page({
  data: {
    list: [],
    loading: false,
  },

  onShow() {
    this.fetchMyActivities();
  },

  fetchMyActivities() {
    this.setData({ loading: true });
    wx.cloud
      .callFunction({
        name: 'events',
        data: {
          action: 'listMyActivities',
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
        const list = (result.list || []).map((item) => ({
          ...item,
          cardClass: item.status === 'canceled' ? 'activity-card canceled' : 'activity-card active',
          statusText: item.status === 'canceled' ? '已取消' : '有效报名',
        }));
        this.setData({ list });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      })
      .finally(() => this.setData({ loading: false }));
  },

  onTapItem(e) {
    const signupId = e.currentTarget.dataset.signupId;
    if (!signupId) return;
    wx.navigateTo({
      url: `/pages/events/my-detail/my-detail?signupId=${signupId}`,
    });
  },
});
