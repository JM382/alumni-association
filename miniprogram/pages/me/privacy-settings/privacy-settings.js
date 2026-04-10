// 隐私设置：本地缓存 + 云端 privacy_settings（最小闭环：他人查看个人主页时按开关脱敏手机/邮箱）
const STORAGE_KEY = 'privacy_settings';

Page({
  data: {
    settings: {
      phoneVisible: false,
      emailVisible: true,
      workVisible: true,
      searchable: true,
      dmFromNonFriend: true,
      circleFriendsOnly: false,
    },
    syncing: false,
  },

  onLoad() {
    this.loadSettings();
  },

  loadSettings() {
    this.setData({ syncing: true });
    wx.cloud
      .callFunction({
        name: 'updatePrivacySettings',
        data: { action: 'get' },
      })
      .then((res) => {
        const result = res.result || {};
        if (result.success && result.settings && typeof result.settings === 'object') {
          const merged = { ...this.data.settings, ...result.settings };
          this.setData({ settings: merged });
          try {
            wx.setStorageSync(STORAGE_KEY, merged);
          } catch (e) {
            console.warn('同步本地隐私缓存失败', e);
          }
          return;
        }
        this.loadFromLocalFallback();
      })
      .catch(() => {
        this.loadFromLocalFallback();
      })
      .finally(() => {
        this.setData({ syncing: false });
      });
  },

  loadFromLocalFallback() {
    try {
      const raw = wx.getStorageSync(STORAGE_KEY);
      if (raw && typeof raw === 'object') {
        this.setData({
          settings: { ...this.data.settings, ...raw },
        });
      }
    } catch (e) {
      console.warn('读取本地隐私设置失败', e);
    }
  },

  onSwitchChange(e) {
    const key = e.currentTarget.dataset.key;
    const value = e.detail.value;
    const checked = value === true || value === 'true';
    const settings = { ...this.data.settings, [key]: checked };
    this.setData({ settings });
    try {
      wx.setStorageSync(STORAGE_KEY, settings);
    } catch (err) {
      console.warn('保存隐私设置失败', err);
    }
    wx.cloud
      .callFunction({
        name: 'updatePrivacySettings',
        data: settings,
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '同步失败', icon: 'none' });
        }
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '同步失败', icon: 'none' });
      });
  },
});
