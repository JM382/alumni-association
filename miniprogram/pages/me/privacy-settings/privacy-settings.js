// 隐私设置：资料可见范围、被搜索与联系、校友圈隐私，开关持久化到本地
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
  },

  onLoad() {
    this.loadSettings();
  },

  loadSettings() {
    try {
      const raw = wx.getStorageSync(STORAGE_KEY);
      if (raw && typeof raw === 'object') {
        this.setData({
          settings: { ...this.data.settings, ...raw },
        });
      }
    } catch (e) {
      console.warn('读取隐私设置失败', e);
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
  },
});
