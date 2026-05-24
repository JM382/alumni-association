// pages/events/my-detail/my-detail.js
Page({
  data: {
    signupId: '',
    loading: false,
    detail: null,
    signing: false,
    canceling: false,
    paying: false,
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

  pollEventSignupPaid(orderNo, maxRetry) {
    const retry = Math.max(1, Number(maxRetry) || 5);
    const attempt = (left) =>
      wx.cloud
        .callFunction({
          name: 'wechatPayOrder',
          data: {
            action: 'queryEventSignupOrder',
            orderNo,
          },
        })
        .then((res) => {
          const result = res.result || {};
          const status = result.status || '';
          if (status === 'PAID') return true;
          if (left <= 1) return false;
          return new Promise((resolve) => {
            setTimeout(() => resolve(attempt(left - 1)), 1200);
          });
        })
        .catch(() => {
          if (left <= 1) return false;
          return new Promise((resolve) => {
            setTimeout(() => resolve(attempt(left - 1)), 1200);
          });
        });
    return attempt(retry);
  },

  onPaySignup() {
    const { detail, paying } = this.data;
    if (paying || !detail || !detail.needsPayment || !detail.orderNo) return;
    const orderNo = detail.orderNo;
    this.setData({ paying: true });
    wx.cloud
      .callFunction({
        name: 'wechatPayOrder',
        data: {
          action: 'createEventSignupPrepay',
          orderNo,
        },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success || !result.payParams) {
          throw new Error(result.error || '拉起支付失败');
        }
        const p = result.payParams;
        return new Promise((resolve, reject) => {
          const pay = {
            timeStamp: String(p.timeStamp || ''),
            nonceStr: String(p.nonceStr || ''),
            package: String(p.package || ''),
            signType: String(p.signType || 'RSA'),
            paySign: String(p.paySign || ''),
          };
          if (p.appId) pay.appId = String(p.appId);
          wx.requestPayment({
            ...pay,
            success: () => resolve(orderNo),
            fail: (err) => reject(err || new Error('支付失败')),
          });
        });
      })
      .then((no) => this.pollEventSignupPaid(no, 6))
      .then((paid) => {
        if (!paid) {
          wx.showToast({ title: '支付处理中，请稍后下拉刷新', icon: 'none' });
          return;
        }
        wx.showToast({ title: '支付成功', icon: 'success' });
        this.fetchDetail();
      })
      .catch((err) => {
        const msg = (err && (err.errMsg || err.message)) || '';
        if (msg.includes('cancel')) {
          wx.showToast({ title: '已取消支付', icon: 'none' });
          return;
        }
        wx.showToast({ title: msg || '支付失败', icon: 'none' });
      })
      .finally(() => {
        this.setData({ paying: false });
      });
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

    const isPendingPay = detail.status === 'pending_payment';
    wx.showModal({
      title: '取消报名',
      content: isPendingPay
        ? '确认取消该报名？未支付的订单将关闭。'
        : '确认取消本次活动报名吗？已获得积分将回扣。',
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

