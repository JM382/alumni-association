// pages/me/resource-publish/resource-publish.js
Page({
  data: {
    title: '',
    desc: '',
    tag: '',
  },

  onTitleInput(e) {
    this.setData({ title: e.detail.value });
  },

  onDescInput(e) {
    this.setData({ desc: e.detail.value });
  },

  onTagInput(e) {
    this.setData({ tag: e.detail.value });
  },

  onSubmit() {
    const { title, desc } = this.data;
    if (!title.trim() || !desc.trim()) {
      wx.showToast({ title: '请填写标题和描述', icon: 'none' });
      return;
    }
    // 先做前端占位，后续接入资源云函数
    wx.showToast({ title: '资源发布稍后接入', icon: 'none' });
  },
});

