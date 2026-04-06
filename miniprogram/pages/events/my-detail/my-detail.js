// pages/events/my-detail/my-detail.js
Page({
  data: {
    signupId: '',
    loading: false,
    detail: null,
    signing: false,
    canceling: false,
  },

  onLoad(options) {
    const signupId = (options && options.signupId) || '';
    if (!signupId) {
      wx.showToast({ title: '缺少报名参数', icon: 'none' });
      return;
    }
    this.setData({ signupId });
    this.fetchDetail();
  },

  fetchDetail() {
    const { signupId } = this.data;
    this.setData({ loading: true });
    wx.cloud
      .callFunction({
        name: 'events',
        data: { action: 'getMySignupDetail', signupId },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '加载失败', icon: 'none' });
          return;
        }
        this.setData({ detail: result.data || null });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      })
      .finally(() => this.setData({ loading: false }));
  },

  onScanSignIn() {
    if (this.data.signing) return;
    wx.scanCode({
      onlyFromCamera: true,
      success: (res) => {
        const code = (res && res.result) || '';
        if (!code) {
          wx.showToast({ title: '未识别到二维码', icon: 'none' });
          return;
        }
        // 当前实现：二维码内容就是 signupId
        this.doSignIn(code.trim());
      },
      fail: () => {
        wx.showToast({ title: '扫码取消', icon: 'none' });
      },
    });
  },

  doSignIn(signupId) {
    this.setData({ signing: true });
    wx.cloud
      .callFunction({
        name: 'events',
        data: { action: 'signIn', signupId },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '签到失败', icon: 'none' });
          return;
        }
        wx.showToast({ title: '签到成功', icon: 'success' });
        this.fetchDetail();
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '签到失败', icon: 'none' });
      })
      .finally(() => this.setData({ signing: false }));
  },

  onCancelSignup() {
    const { signupId, detail, canceling } = this.data;
    if (canceling || !signupId) return;
    if (!detail) return;
    if (detail.status === 'canceled') {
      wx.showToast({ title: '该报名已取消', icon: 'none' });
      return;
    }
    if (detail.signInStatus === 'signed') {
      wx.showToast({ title: '已签到记录不可取消', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '取消报名',
      content: '确认取消本次活动报名吗？已获得积分将回扣。',
      confirmText: '确认取消',
      cancelText: '再想想',
      success: (r) => {
        if (!r.confirm) return;
        this.setData({ canceling: true });
        wx.cloud
          .callFunction({
            name: 'events',
            data: { action: 'cancelSignup', signupId },
          })
          .then((res) => {
            const result = res.result || {};
            if (!result.success) {
              wx.showToast({ title: result.error || '取消失败', icon: 'none' });
              return;
            }
            wx.showToast({ title: '已取消报名', icon: 'success' });
            this.fetchDetail();
          })
          .catch((err) => {
            wx.showToast({ title: err.message || '取消失败', icon: 'none' });
          })
          .finally(() => this.setData({ canceling: false }));
      },
    });
  },
});

