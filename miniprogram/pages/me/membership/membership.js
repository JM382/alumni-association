// 会员中心页

Page({
  data: {
    title: '会员中心',
    loading: false,
    /** 正在开通的套餐 key，空字符串表示未在支付 */
    creatingPlanKey: '',
    refunding: false,
    info: {
      level: 'none',
      isValid: false,
      expireAt: null,
      expireAtText: '暂无',
      identity: 'visitor',
    },
    refundEligible: false,
    refundTip: '',
    refundOrderNo: '',
    refundRemainSeconds: 0,
    plans: [
      {
        key: 'vip_month',
        level: 'vip',
        name: 'VIP 月度会员',
        priceText: '￥19.99 / 月',
        desc: '解锁基础会员特权，适合轻度使用',
      },
      {
        key: 'svip_year',
        level: 'svip',
        name: 'SVIP 年度会员',
        priceText: '￥299 / 年',
        desc: '更划算的年度会员，享受全部高级特权',
        highlight: true,
      },
    ],
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: this.data.title });
    this.fetchInfo();
    this.loadRefundEligibility();
  },

  onShow() {
    this.fetchInfo();
    this.loadRefundEligibility();
  },

  formatExpire(expireAt) {
    if (!expireAt) return '暂无';
    const d = new Date(expireAt);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  fetchInfo() {
    this.setData({ loading: true });
    wx.cloud
      .callFunction({
        name: 'membership',
        data: { action: 'getInfo' },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '加载失败', icon: 'none' });
          return;
        }
        const info = result.data || {};
        info.expireAtText = this.formatExpire(info.expireAt);
        this.setData({ info });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  loadRefundEligibility() {
    wx.cloud
      .callFunction({
        name: 'membership',
        data: {
          action: 'getRefundEligibility',
          limitMinutes: 30,
        },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          this.setData({
            refundEligible: false,
            refundTip: '',
            refundOrderNo: '',
            refundRemainSeconds: 0,
          });
          return;
        }
        const remain = Number(result.remainSeconds) || 0;
        const tip = result.eligible
          ? `可退款，剩余${Math.max(0, Math.floor(remain / 60))}分钟`
          : (result.reason || '');
        this.setData({
          refundEligible: !!result.eligible,
          refundTip: tip,
          refundOrderNo: (result.data && result.data.orderNo) || '',
          refundRemainSeconds: remain,
        });
      })
      .catch(() => {
        this.setData({
          refundEligible: false,
          refundTip: '',
          refundOrderNo: '',
          refundRemainSeconds: 0,
        });
      });
  },

  pollOrderPaid(orderNo, maxRetry) {
    const retry = Math.max(1, Number(maxRetry) || 5);
    const attempt = (left) =>
      wx.cloud
        .callFunction({
          name: 'wechatPayOrder',
          data: {
            action: 'queryMembershipOrder',
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

  onBuyTap(e) {
    const planKey = e.currentTarget.dataset.key;
    const { identity } = this.data.info;

    if (identity !== 'alumni') {
      wx.showToast({ title: '仅校友可开通会员', icon: 'none' });
      return;
    }

    if (this.data.creatingPlanKey) return;
    this.setData({ creatingPlanKey: planKey });

    wx.cloud
      .callFunction({
        name: 'membership',
        data: {
          action: 'createOrder',
          planKey,
        },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          throw new Error(result.error || '创建订单失败');
        }
        return wx.cloud.callFunction({
          name: 'wechatPayOrder',
          data: {
            action: 'createMembershipPrepay',
            orderNo: result.orderNo,
          },
        });
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
            success: () => resolve(result.orderNo),
            fail: (err) => reject(err || new Error('支付失败')),
          });
        });
      })
      .then((orderNo) => this.pollOrderPaid(orderNo, 6))
      .then((paid) => {
        if (!paid) {
          wx.showToast({ title: '支付处理中，请稍后刷新', icon: 'none' });
          return;
        }
        wx.showToast({ title: '会员已开通', icon: 'success' });
        this.fetchInfo();
        this.loadRefundEligibility();
      })
      .catch((err) => {
        const msg = (err && (err.errMsg || err.message)) || '';
        if (msg.includes('cancel')) {
          wx.showToast({ title: '已取消支付', icon: 'none' });
          return;
        }
        wx.showToast({ title: msg || '开通失败', icon: 'none' });
      })
      .finally(() => {
        this.setData({ creatingPlanKey: '' });
      });
  },

  onRefundTap() {
    if (this.data.refunding) return;
    if (!this.data.refundEligible || !this.data.refundOrderNo) {
      wx.showToast({ title: this.data.refundTip || '当前不可退款', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '确认退款',
      content: '仅支持支付后30分钟内全额退款，确认申请吗？',
      success: (r) => {
        if (!r.confirm) return;
        this.setData({ refunding: true });
        wx.cloud
          .callFunction({
            name: 'wechatPayOrder',
            data: {
              action: 'requestMembershipRefund',
              orderNo: this.data.refundOrderNo,
              reason: '用户主动申请退款',
            },
          })
          .then((res) => {
            const result = res.result || {};
            if (!result.success) {
              wx.showToast({ title: result.error || '退款申请失败', icon: 'none' });
              return;
            }
            wx.showToast({ title: '退款申请已提交', icon: 'success' });
            this.fetchInfo();
            this.loadRefundEligibility();
          })
          .catch((err) => {
            wx.showToast({ title: err.message || '退款申请失败', icon: 'none' });
          })
          .finally(() => {
            this.setData({ refunding: false });
          });
      },
    });
  },
});
