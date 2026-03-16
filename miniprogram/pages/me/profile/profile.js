// 个人信息页：头像、昵称、手机、邮箱（必填）、性别、生日、城市、简介，保存到 users
Page({
  data: {
    form: {
      avatarUrl: '',
      nickname: '',
      mobile: '',
      email: '',
      gender: '',
      birthday: '',
      city: '',
      bio: '',
    },
    genderOptions: [
      { value: 'male', label: '男' },
      { value: 'female', label: '女' },
      { value: '', label: '保密' },
    ],
    genderIndex: 2,
    genderText: '保密',
    today: '2025-12-31',
    saving: false,
  },

  onLoad() {
    const d = new Date();
    this.setData({
      today: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    });
  },

  onShow() {
    this.loadUserInfo();
  },

  loadUserInfo() {
    wx.cloud.callFunction({ name: 'getUserInfo' }).then((res) => {
      const result = res.result || {};
      const data = (result.code === 0 && result.data) ? result.data : {};
      const nickname = data.nickname || data.nickName || '';
      const gender = data.gender || '';
      let genderIndex = 2;
      if (gender === 'male') genderIndex = 0;
      else if (gender === 'female') genderIndex = 1;
      const genderText = ['男', '女', '保密'][genderIndex];
      this.setData({
        form: {
          avatarUrl: data.avatarUrl || '',
          nickname: nickname,
          mobile: data.mobile || '',
          email: data.email || '',
          gender: gender,
          birthday: data.birthday || '',
          city: data.city || '',
          bio: data.bio || '',
        },
        genderIndex,
        genderText,
      });
    }).catch(() => {});
  },

  onFieldInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  onGenderChange(e) {
    const i = parseInt(e.detail.value, 10);
    const opt = this.data.genderOptions[i];
    this.setData({
      genderIndex: i,
      genderText: opt.label,
      'form.gender': opt.value,
    });
  },

  onBirthdayChange(e) {
    this.setData({ 'form.birthday': e.detail.value });
  },

  onRegionChange(e) {
    const arr = e.detail.value || [];
    const city = arr.length >= 2 ? arr[1] : (arr[0] || '');
    this.setData({ 'form.city': city });
  },

  onAvatarError() {
    this.setData({ 'form.avatarUrl': '' });
  },

  onChangeAvatar() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const filePath = res.tempFilePaths[0];
        const cloudPath = `avatars/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
        wx.showLoading({ title: '上传中' });
        wx.cloud.uploadFile({
          cloudPath,
          filePath,
          success: (up) => {
            wx.hideLoading();
            this.setData({ 'form.avatarUrl': up.fileID });
          },
          fail: () => {
            wx.hideLoading();
            wx.showToast({ title: '上传失败', icon: 'none' });
          },
        });
      },
    });
  },

  validate() {
    const { mobile, email } = this.data.form;
    const mobileTrim = (mobile || '').trim();
    const emailTrim = (email || '').trim();
    if (!mobileTrim) {
      wx.showToast({ title: '请填写手机号码', icon: 'none' });
      return false;
    }
    if (!/^1\d{10}$/.test(mobileTrim)) {
      wx.showToast({ title: '手机号格式不正确', icon: 'none' });
      return false;
    }
    if (!emailTrim) {
      wx.showToast({ title: '请填写邮箱', icon: 'none' });
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      wx.showToast({ title: '邮箱格式不正确', icon: 'none' });
      return false;
    }
    return true;
  },

  onSubmit() {
    if (this.data.saving) return;
    if (!this.validate()) return;
    this.setData({ saving: true });
    const form = this.data.form;
    wx.cloud.callFunction({
      name: 'updateUserProfile',
      data: {
        nickname: (form.nickname || '').trim() || undefined,
        mobile: (form.mobile || '').trim(),
        email: (form.email || '').trim(),
        gender: form.gender || undefined,
        birthday: form.birthday || undefined,
        city: form.city || undefined,
        bio: (form.bio || '').trim() || undefined,
        avatarUrl: form.avatarUrl || undefined,
      },
    }).then((res) => {
      const result = res.result || {};
      if (!result.success) {
        wx.showToast({ title: result.error || '保存失败', icon: 'none' });
        return;
      }
      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    }).catch((err) => {
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
    }).finally(() => {
      this.setData({ saving: false });
    });
  },
});
