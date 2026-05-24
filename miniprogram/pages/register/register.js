// pages/register/register.js
const app = getApp();

Page({
  data: {
    form: {
      alumniCardNo: '',
      enrollYear: '',
      department: '',
      phone: '',
      email: '',
    },
    submitting: false,
  },

  onLoad() {
    const pending = app.globalData.pendingRegister;
    if (!pending) {
      wx.showToast({ title: '请从首页登录进入', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  onAlumniCardNoChange(e) {
    this.setData({ 'form.alumniCardNo': e.detail.value });
  },

  onEnrollYearChange(e) {
    this.setData({ 'form.enrollYear': e.detail.value });
  },

  onDepartmentChange(e) {
    this.setData({ 'form.department': e.detail.value });
  },

  onPhoneChange(e) {
    this.setData({ 'form.phone': e.detail.value });
  },

  onEmailChange(e) {
    this.setData({ 'form.email': e.detail.value });
  },

  async onSubmit() {
    const { form } = this.data;
    if (!form.alumniCardNo || !form.alumniCardNo.trim()) {
      wx.showToast({ title: '请填写校友卡号', icon: 'none' });
      return;
    }
    if (!form.enrollYear || !form.enrollYear.trim()) {
      wx.showToast({ title: '请填写入学年份', icon: 'none' });
      return;
    }
    if (!form.department || !form.department.trim()) {
      wx.showToast({ title: '请填写院系', icon: 'none' });
      return;
    }
    if (!form.phone || !form.phone.trim()) {
      wx.showToast({ title: '请填写手机号', icon: 'none' });
      return;
    }

    const pending = app.globalData.pendingRegister;
    if (!pending) {
      wx.showToast({ title: '登录信息已过期，请重新登录', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      await wx.cloud.callFunction({
        name: 'register',
        data: {
          nickName: pending.nickName,
          avatarUrl: pending.avatarUrl,
          alumniCardNo: form.alumniCardNo.trim(),
          enrollYear: form.enrollYear.trim(),
          department: form.department.trim(),
          phone: form.phone.trim(),
          email: (form.email || '').trim(),
        },
      });
      const nick = pending.nickName || '校友';
      const avatar = pending.avatarUrl || '';
      app.globalData.userNickName = nick;
      wx.setStorageSync('userNickName', nick);
      if (avatar) wx.setStorageSync('userAvatarUrl', avatar);
      app.globalData.pendingRegister = undefined;
      wx.showToast({ title: '注册成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (e) {
      console.error('注册失败', e);
      wx.showToast({ title: '提交失败，请稍后重试', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
