// pages/me/user-profile/user-profile.js
const db = wx.cloud.database();

Page({
  data: {
    userId: '',
    user: {},
    isSelf: false,
    following: false,
    isMutual: false,
    followLoading: false,
    msgLoading: false,
  },

  onLoad(options) {
    const userId = (options && options.userId) || '';
    if (!userId) {
      wx.showToast({ title: '缺少用户信息', icon: 'none' });
      return;
    }
    this.setData({ userId });
    this.fetchUser();
    this.fetchFollowStatus();
  },

  // 读取用户基本信息（直接从 users 集合按 user_id 查询）
  fetchUser() {
    const { userId } = this.data;
    db.collection('users')
      .where({ user_id: userId })
      .limit(1)
      .get()
      .then((res) => {
        if (!res.data || res.data.length === 0) {
          wx.showToast({ title: '用户不存在', icon: 'none' });
          return;
        }
        const u = res.data[0];
        const myOpenid = wx.getStorageSync('openid') || '';
        const isSelf = !!(myOpenid && u.openid === myOpenid);
        const identity = u.identity || 'visitor';
        let identityText = '游客';
        if (identity === 'alumni') identityText = '校友';
        else if (identity === 'company') identityText = '企业用户';
        else if (identity === 'expert') identityText = '专家';

        this.setData({
          user: {
            userId,
            nickname: u.nickname || '校友',
            avatarUrl: u.avatarUrl || '',
            identity,
            identityText,
            schoolName: u.schoolName || '',
            major: u.major || '',
            enterYear: u.enterYear || '',
            city: u.city || '',
          },
          isSelf,
        });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      });
  },

  // 查询关注/互关状态
  fetchFollowStatus() {
    const { userId } = this.data;
    wx.cloud
      .callFunction({
        name: 'social',
        data: {
          action: 'getFollowStatus',
          targetUserId: userId,
        },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) return;
        this.setData({
          following: !!result.following,
          isMutual: !!result.isMutual,
        });
      })
      .catch(() => {});
  },

  onToggleFollow() {
    const { userId, isSelf, followLoading } = this.data;
    if (isSelf || followLoading) return;
    this.setData({ followLoading: true });
    wx.cloud
      .callFunction({
        name: 'social',
        data: {
          action: 'toggleFollow',
          targetUserId: userId,
        },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '操作失败', icon: 'none' });
          return;
        }
        this.setData({
          following: !!result.following,
          isMutual: !!result.isMutual,
        });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '操作失败', icon: 'none' });
      })
      .finally(() => {
        this.setData({ followLoading: false });
      });
  },

  onStartChat() {
    const { userId, isSelf, msgLoading } = this.data;
    if (isSelf || msgLoading) return;
    this.setData({ msgLoading: true });
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
        // 这里先只提示会话已创建，后续再接入聊天页面
        wx.showToast({ title: '会话已创建，聊天稍后接入', icon: 'none' });
        console.log('conversationId:', result.conversationId);
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '发起失败', icon: 'none' });
      })
      .finally(() => {
        this.setData({ msgLoading: false });
      });
  },
});

