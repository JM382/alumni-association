Page({
  data: {
    category: 'publish',
    list: [],
    loading: false,
    page: 1,
    pageSize: 20,
  },

  onLoad() {
    this.fetchList(true);
  },

  onShow() {
    this.fetchList(true);
  },

  onPullDownRefresh() {
    this.fetchList(true).finally(() => wx.stopPullDownRefresh());
  },

  fetchList(reset) {
    if (this.data.loading) return Promise.resolve();
    const page = reset ? 1 : this.data.page;
    this.setData({ loading: true });
    return wx.cloud
      .callFunction({
        name: 'resources',
        data: {
          action: 'listPosts',
          category: this.data.category,
          page,
          pageSize: this.data.pageSize,
        },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '加载失败', icon: 'none' });
          return;
        }
        const next = reset ? result.list || [] : (this.data.list || []).concat(result.list || []);
        this.setData({ list: next, page: page + 1 });
      })
      .catch((err) => wx.showToast({ title: err.message || '加载失败', icon: 'none' }))
      .finally(() => this.setData({ loading: false }));
  },

  onGoPublish() {
    wx.navigateTo({
      url: `/pages/me/resource-create/resource-create?category=publish`,
    });
  },

  onTapUser(e) {
    const userId = e.currentTarget.dataset.userId;
    if (!userId) return;
    wx.navigateTo({
      url: `/pages/me/user-profile/user-profile?userId=${userId}`,
    });
  },

  onToggleLike(e) {
    const postId = e.currentTarget.dataset.id;
    if (!postId) return;
    wx.cloud
      .callFunction({
        name: 'resources',
        data: { action: 'toggleLike', postId },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '操作失败', icon: 'none' });
          return;
        }
        const liked = !!result.liked;
        const list = (this.data.list || []).map((p) => {
          if (p._id !== postId) return p;
          const next = { ...p };
          next.hasLiked = liked;
          next.likeCount = (next.likeCount || 0) + (liked ? 1 : -1);
          if (next.likeCount < 0) next.likeCount = 0;
          return next;
        });
        this.setData({ list });
      })
      .catch((err) => wx.showToast({ title: err.message || '操作失败', icon: 'none' }));
  },

  onGoDetail(e) {
    const postId = e.currentTarget.dataset.id;
    if (!postId) return;
    wx.navigateTo({
      url: `/pages/me/resource-detail/resource-detail?postId=${postId}`,
    });
  },
});

