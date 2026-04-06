// pages/events/tickets/tickets.js
Page({
  data: {
    eventId: '',
    event: null,
    checkedDuplicate: false,
    ticketIndex: 0,
    showProtocol: false,
    agree: false,
    form: {
      realName: '',
      mobile: '',
      peopleCount: 1,
      remark: '',
    },
    submitting: false,
  },

  onLoad(options) {
    const eventId = (options && options.eventId) || '';
    this.setData({ eventId });
    this.checkMySignupAndRedirect();
    this.fetchDetail();
  },

  checkMySignupAndRedirect() {
    const { eventId } = this.data;
    if (!eventId) return;
    wx.cloud
      .callFunction({
        name: 'events',
        data: { action: 'checkMySignup', eventId },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) return;
        if (result.hasSignedUp && result.signupId) {
          wx.showToast({ title: '你已报名过该活动', icon: 'none' });
          wx.redirectTo({
            url: `/pages/events/my-detail/my-detail?signupId=${result.signupId}`,
          });
          return;
        }
        this.setData({ checkedDuplicate: true });
      })
      .catch(() => this.setData({ checkedDuplicate: true }));
  },

  fetchDetail() {
    const { eventId } = this.data;
    if (!eventId) return;
    wx.cloud
      .callFunction({
        name: 'events',
        data: { action: 'getDetail', eventId },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '加载失败', icon: 'none' });
          return;
        }
        const ev = result.data || null;
        this.setData({
          event: ev,
          ticketIndex: 0,
        });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      });
  },

  onChooseTicket(e) {
    const idx = Number(e.currentTarget.dataset.index);
    if (Number.isNaN(idx)) return;
    this.setData({ ticketIndex: idx });
  },

  onToggleProtocol() {
    this.setData({ showProtocol: !this.data.showProtocol });
  },

  onAgreeChange() {
    this.setData({ agree: !this.data.agree });
  },

  onRealNameInput(e) {
    this.setData({ 'form.realName': e.detail.value });
  },

  onMobileInput(e) {
    this.setData({ 'form.mobile': e.detail.value });
  },

  onPeopleCountInput(e) {
    const v = Number(e.detail.value) || 1;
    this.setData({ 'form.peopleCount': Math.max(1, v) });
  },

  onRemarkInput(e) {
    this.setData({ 'form.remark': e.detail.value });
  },

  onSubmit() {
    const { eventId, event, ticketIndex, form, agree, submitting } = this.data;
    if (submitting) return;
    if (!event) {
      wx.showToast({ title: '活动信息未加载', icon: 'none' });
      return;
    }
    const options = Array.isArray(event.ticketOptions) ? event.ticketOptions : [];
    const tk = options[ticketIndex];
    if (!tk) {
      wx.showToast({ title: '请选择票种', icon: 'none' });
      return;
    }
    if (!form.realName.trim() || !form.mobile.trim()) {
      wx.showToast({ title: '请填写姓名和手机号', icon: 'none' });
      return;
    }
    if (!agree) {
      wx.showToast({ title: '请先同意报名协议', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    wx.cloud
      .callFunction({
        name: 'events',
        data: {
          action: 'createSignup',
          eventId,
          ticketId: tk.ticketId,
          realName: form.realName,
          mobile: form.mobile,
          peopleCount: form.peopleCount,
          remark: form.remark,
        },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          // 云端重复报名：直接引导查看报名详情
          if (result.signupId) {
            wx.showToast({ title: result.error || '你已报名过该活动', icon: 'none' });
            wx.redirectTo({
              url: `/pages/events/my-detail/my-detail?signupId=${result.signupId}`,
            });
            return;
          }
          wx.showToast({ title: result.error || '报名失败', icon: 'none' });
          return;
        }
        wx.showToast({ title: '报名成功', icon: 'success' });
        // 跳到我的活动
        wx.navigateTo({
          url: '/pages/me/my-activities/my-activities',
        });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '报名失败', icon: 'none' });
      })
      .finally(() => this.setData({ submitting: false }));
  },
});

