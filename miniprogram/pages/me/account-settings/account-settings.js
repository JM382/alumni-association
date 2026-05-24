// 账号设置：账号安全（手机号、登录设备管理）、账号管理（注销账号、退出账号）
Page({
  data: {
    mobile: '',
  },

  onShow() {
    this.loadMobile();
  },

  loadMobile() {
    wx.cloud
      .callFunction({ name: 'getUserInfo' })
      .then((res) => {
        const result = res.result || {};
        const data = (result.code === 0 && result.data) ? result.data : {};
        this.setData({
          mobile: (data.mobile || '').trim() || '',
        });
      })
      .catch(() => {
        this.setData({ mobile: '' });
      });
  },

  onMobileTap() {
    // 手机号可后续做修改手机号页，此处仅展示
  },

  onDeviceManageTap() {
    wx.showToast({ title: '正在开发中', icon: 'none' });
  },

  onDeregisterTap() {
    wx.showModal({
      title: '确定要注销',
      content: '注销后数据将无法恢复，请谨慎操作',
      confirmText: '确定',
      cancelText: '再想想',
      confirmColor: '#b01e2b',
      success: (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中' });
        wx.cloud
          .callFunction({
            name: 'updateUserProfile',
            data: { deregister: true },
          })
          .then((result) => {
            wx.hideLoading();
            const ret = result.result || {};
            if (!ret.success) {
              wx.showToast({ title: ret.error || '注销失败', icon: 'none' });
              return;
            }
            wx.showToast({ title: '已注销', icon: 'none' });
            setTimeout(() => {
              wx.reLaunch({ url: '/pages/login/login' });
            }, 800);
          })
          .catch((err) => {
            wx.hideLoading();
            wx.showToast({ title: err.message || '注销失败', icon: 'none' });
          });
      },
    });
  },

  onLogoutTap() {
    wx.reLaunch({ url: '/pages/login/login' });
  },
});
