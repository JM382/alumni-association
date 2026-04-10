const VIP_BADGE_IMAGE = 'https://636c-cloud1-7g1x07md7360212c-1406143873.tcb.qcloud.la/membership/VIP.png?sign=c57b3c86e4a346a51ac4c1bafacf96ba&t=1774960586';
const SVIP_BADGE_IMAGE = 'https://636c-cloud1-7g1x07md7360212c-1406143873.tcb.qcloud.la/membership/SVIP.png?sign=2c744ff1e46ec63c0fcf09ae84258eb8&t=1774960608';

function toTimestamp(v) {
  if (!v) return 0;
  if (v instanceof Date) return v.getTime();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function resolveMembershipBadge(data) {
  const level = ((data && data.membershipLevel) || '').toLowerCase();
  const expireAt = data && data.membershipExpireAt;
  const valid = toTimestamp(expireAt) > Date.now();
  if (!valid) return { level: '', image: '' };
  if (level === 'svip') return { level: 'svip', image: SVIP_BADGE_IMAGE };
  if (level === 'vip') return { level: 'vip', image: VIP_BADGE_IMAGE };
  return { level: '', image: '' };
}

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

  // 读取用户基本信息（走云函数，避免小程序端直连 users 被权限规则拦截）
  fetchUser() {
    const { userId } = this.data;
    wx.cloud
      .callFunction({
        name: 'social',
        data: {
          action: 'getUserProfile',
          targetUserId: userId,
        },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '加载失败', icon: 'none' });
          return;
        }
        const user = result.user || {};
        const membership = resolveMembershipBadge(user);
        this.setData({
          user: {
            ...user,
            membershipLevel: membership.level,
            membershipBadgeImage: membership.image,
          },
          isSelf: !!result.isSelf,
        });
      })
      .catch((err) => wx.showToast({ title: err.message || '加载失败', icon: 'none' }));
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
        const conversationId = result.conversationId;
        const targetUser = result.targetUser || {};
        wx.navigateTo({
          url: `/pages/chat/chat?conversationId=${conversationId}&targetUserId=${userId}&targetName=${encodeURIComponent(
            targetUser.nickname || this.data.user.nickname || '聊天'
          )}&targetAvatarUrl=${encodeURIComponent(targetUser.avatarUrl || this.data.user.avatarUrl || '')}`,
        });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '发起失败', icon: 'none' });
      })
      .finally(() => {
        this.setData({ msgLoading: false });
      });
  },
});

