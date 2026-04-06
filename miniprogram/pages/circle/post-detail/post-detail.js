// pages/circle/post-detail/post-detail.js
Page({
  data: {
    postId: '',
    loading: false,
    post: null,
    comments: [],
    input: '',
    replyingTo: null, // { parentId, replyToUserId, hint }
    sending: false,
  },

  onTapUser(e) {
    const userId = e.currentTarget.dataset.userId;
    if (!userId) return;
    wx.navigateTo({
      url: `/pages/me/user-profile/user-profile?userId=${userId}`,
    });
  },

  onLoad(options) {
    const postId = (options && options.postId) || '';
    if (!postId) {
      wx.showToast({ title: '缺少动态参数', icon: 'none' });
      return;
    }
    this.setData({ postId });
    this.fetchDetail();
  },

  fetchDetail() {
    const { postId } = this.data;
    this.setData({ loading: true });
    wx.cloud
      .callFunction({
        name: 'circle',
        data: {
          action: 'getPostDetail',
          postId,
        },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '加载失败', icon: 'none' });
          return;
        }
        const post = result.post || null;
        const comments = result.comments || [];
        this.setData({ post, comments });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      })
      .finally(() => this.setData({ loading: false }));
  },

  onInput(e) {
    this.setData({ input: e.detail.value });
  },

  onTapReply(e) {
    const parentId = e.currentTarget.dataset.parentId;
    const replyToUserId = e.currentTarget.dataset.replyToUserId || '';
    const nickname = e.currentTarget.dataset.nickname || '';
    if (!parentId) return;
    this.setData({
      replyingTo: {
        parentId,
        replyToUserId,
        hint: nickname ? `回复 ${nickname}` : '回复',
      },
    });
  },

  onCancelReply() {
    this.setData({ replyingTo: null });
  },

  onSubmit() {
    if (this.data.sending) return;
    const content = (this.data.input || '').trim();
    if (!content) {
      wx.showToast({ title: '请输入评论内容', icon: 'none' });
      return;
    }
    const { postId, replyingTo } = this.data;
    const payload = {
      action: 'addComment',
      postId,
      content,
    };
    if (replyingTo && replyingTo.parentId) {
      payload.parentId = replyingTo.parentId;
      payload.replyToUserId = replyingTo.replyToUserId || '';
    }

    this.setData({ sending: true });
    wx.cloud
      .callFunction({
        name: 'circle',
        data: payload,
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '发送失败', icon: 'none' });
          return;
        }
        wx.showToast({ title: '评论成功', icon: 'success' });
        this.setData({ input: '', replyingTo: null });
        this.fetchDetail();
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '发送失败', icon: 'none' });
      })
      .finally(() => this.setData({ sending: false }));
  },
});
