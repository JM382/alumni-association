// 消息通知：消息提醒 + 其他，开关持久化到本地
const STORAGE_KEY = 'notification_settings';

Page({
  data: {
    settings: {
      activityOn: true,
      systemOn: true,
      interactOn: true,
      circleOn: true,
      soundOn: true,
      vibrateOn: true,
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
      console.warn('读取消息通知设置失败', e);
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
      console.warn('保存消息通知设置失败', err);
    }
    wx.cloud.callFunction({
      name: 'updateNotificationSettings',
      data: settings,
    }).catch((err) => {
      console.warn('同步到云端失败', err);
    });
  },
});
