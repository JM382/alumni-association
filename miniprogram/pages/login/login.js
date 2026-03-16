// pages/login/login.js - 仅微信一键登录
Page({
  data: {
    userInfo: null,
    agreed: false,
    loading: false,
  },

  onLoad() {
    const storedUser = wx.getStorageSync('userInfo');
    if (storedUser && storedUser._id) {
      this.setData({ userInfo: storedUser });
    }
  },

  // 勾选协议
  onAgreementChange(e) {
    const agreed = e.detail.value.includes('agreed');
    this.setData({ agreed });
  },

  // 点击“微信一键登录”
  wechatLogin() {
    if (!this.data.agreed) {
      wx.showToast({
        title: '请先勾选同意协议',
        icon: 'none',
      });
      return;
    }

    if (this.data.loading) return;
    this.setData({ loading: true });

    // 先尝试获取微信头像、昵称（getUserProfile 在部分环境已不可用，失败也继续登录）
    const doLogin = (nickname, avatarUrl) => {
      wx.cloud
        .callFunction({
          name: 'login',
          data: { nickname: nickname || '', avatarUrl: avatarUrl || '' },
        })
        .then((res) => {
          const result = res.result || {};
          if (!result.success || !result.user) {
            wx.showToast({
              title: result.error || '登录失败',
              icon: 'none',
              duration: 2500,
            });
            return;
          }

          const user = result.user;
          const storedUser = {
            ...user,
            nickName: user.nickname,
            avatarUrl: user.avatarUrl,
          };

          wx.setStorageSync('userInfo', storedUser);
          wx.setStorageSync('token', user._id);
          wx.setStorageSync('loginType', 'wechat');

          this.setData({ userInfo: storedUser });

          wx.showToast({
            title: '登录成功',
            icon: 'success',
            duration: 800,
          });

          setTimeout(() => {
            wx.switchTab({ url: '/pages/index/index' });
          }, 600);
        })
        .catch((err) => {
          console.error('调用 login 云函数失败：', err);
          wx.showToast({
            title: err.message || '登录失败',
            icon: 'none',
          });
        })
        .finally(() => {
          this.setData({ loading: false });
        });
    };

    if (typeof wx.getUserProfile === 'function') {
      wx.getUserProfile({
        desc: '用于完善校友资料',
        success: (profileRes) => {
          const userInfo = profileRes.userInfo || {};
          doLogin(userInfo.nickName || '', userInfo.avatarUrl || '');
        },
        fail: () => {
          this.setData({ loading: false });
          wx.showToast({ title: '已取消授权', icon: 'none' });
        },
      });
    } else {
      // 无 getUserProfile 时直接登录，昵称/头像在「个人信息」里再填
      doLogin('', '');
    }
  },

  // 显示用户协议
  showAgreement() {
    wx.showModal({
      title: '用户协议',
      content: '这里是校友会小程序的用户协议内容...',
      showCancel: false,
      confirmText: '我知道了',
    });
  },

  // 显示隐私政策
  showPrivacy() {
    wx.showModal({
      title: '隐私政策',
      content: '这里是校友会小程序的隐私政策内容...',
      showCancel: false,
      confirmText: '我知道了',
    });
  },
});