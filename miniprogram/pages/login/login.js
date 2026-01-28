// pages/login/login.js
Page({
  data: {
    // 用户信息
    userInfo: null,
    isAuthenticated: false,
    
    // 手机号登录相关
    phone: '',
    code: '',
    codeText: '获取验证码',
    canSendCode: true,
    canLogin: false,
    
    // 协议同意状态
    agreed: false,
    
    // 倒计时
    countdown: 0,
    timer: null
  },

  onLoad() {
    // 检查本地存储的登录状态
    this.checkLoginStatus();
  },

  onShow() {
    // 页面显示时检查登录状态
    this.checkLoginStatus();
  },

  onUnload() {
    // 页面卸载时清除定时器
    if (this.data.timer) {
      clearInterval(this.data.timer);
    }
  },

  // 检查登录状态
  checkLoginStatus() {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    
    if (token && userInfo) {
      this.setData({
        isAuthenticated: true,
        userInfo: userInfo
      });
    }
  },

  // 微信登录
  wechatLogin() {
    if (!this.data.agreed) {
      wx.showToast({
        title: '请先同意协议',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '登录中...',
      mask: true
    });

    // 1. 获取用户授权
    wx.getUserProfile({
      desc: '用于完善会员资料',
      success: (profileRes) => {
        // 2. 获取微信登录code
        wx.login({
          success: (loginRes) => {
            if (loginRes.code) {
              this.wechatLoginRequest(loginRes.code, profileRes.userInfo);
            } else {
              wx.hideLoading();
              wx.showToast({
                title: '登录失败，请重试',
                icon: 'error'
              });
            }
          },
          fail: () => {
            wx.hideLoading();
            wx.showToast({
              title: '登录失败',
              icon: 'error'
            });
          }
        });
      },
      fail: (err) => {
        wx.hideLoading();
        if (err.errMsg.includes('auth deny')) {
          wx.showModal({
            title: '提示',
            content: '需要授权才能登录，请点击确定重新授权',
            success: (res) => {
              if (res.confirm) {
                this.wechatLogin();
              }
            }
          });
        }
      }
    });
  },

  // 微信登录请求
  wechatLoginRequest(code, userInfo) {
    // 这里应该调用你的后端API
    // 模拟API请求
    setTimeout(() => {
      wx.hideLoading();
      
      // 模拟返回的用户数据
      const mockUserData = {
        userId: 'USER_' + Date.now(),
        token: 'TOKEN_' + Math.random().toString(36).substr(2),
        ...userInfo
      };

      // 保存登录状态
      wx.setStorageSync('token', mockUserData.token);
      wx.setStorageSync('userInfo', mockUserData);
      wx.setStorageSync('loginType', 'wechat');

      this.setData({
        isAuthenticated: true,
        userInfo: mockUserData
      });

      wx.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 1500
      });

      // 登录成功后的事件
      this.onLoginSuccess(mockUserData);
    }, 1500);
  },

  // 手机号输入
  onPhoneInput(e) {
    const phone = e.detail.value;
    const canSendCode = this.validatePhone(phone);
    
    this.setData({
      phone,
      canSendCode,
      canLogin: canSendCode && this.data.code.length === 6 && this.data.agreed
    });
  },

  // 验证码输入
  onCodeInput(e) {
    const code = e.detail.value;
    const canLogin = this.validatePhone(this.data.phone) && code.length === 6 && this.data.agreed;
    
    this.setData({
      code,
      canLogin
    });
  },

  // 验证手机号
  validatePhone(phone) {
    const reg = /^1[3-9]\d{9}$/;
    return reg.test(phone);
  },

  // 发送验证码
  sendCode() {
    if (!this.data.canSendCode) return;
    
    const phone = this.data.phone;
    if (!this.validatePhone(phone)) {
      wx.showToast({
        title: '请输入正确的手机号',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '发送中...',
      mask: true
    });

    // 模拟发送验证码请求
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({
        title: '验证码已发送',
        icon: 'success'
      });

      // 开始倒计时
      this.startCountdown();
    }, 1000);
  },

  // 开始倒计时
  startCountdown() {
    let countdown = 60;
    
    this.setData({
      canSendCode: false,
      countdown: countdown,
      codeText: `${countdown}s后重新获取`
    });

    this.data.timer = setInterval(() => {
      countdown--;
      
      if (countdown <= 0) {
        clearInterval(this.data.timer);
        this.setData({
          canSendCode: true,
          codeText: '获取验证码'
        });
        return;
      }

      this.setData({
        countdown: countdown,
        codeText: `${countdown}s后重新获取`
      });
    }, 1000);
  },

  // 手机号登录
  phoneLogin() {
    if (!this.data.canLogin) {
      if (!this.data.agreed) {
        wx.showToast({
          title: '请先同意协议',
          icon: 'none'
        });
      } else if (!this.validatePhone(this.data.phone)) {
        wx.showToast({
          title: '请输入正确的手机号',
          icon: 'none'
        });
      } else if (this.data.code.length !== 6) {
        wx.showToast({
          title: '请输入6位验证码',
          icon: 'none'
        });
      }
      return;
    }

    wx.showLoading({
      title: '登录中...',
      mask: true
    });

    // 模拟手机号登录请求
    setTimeout(() => {
      wx.hideLoading();

      // 模拟返回的用户数据
      const mockUserData = {
        userId: 'USER_' + Date.now(),
        token: 'TOKEN_' + Math.random().toString(36).substr(2),
        nickName: '手机用户',
        avatarUrl: '/images/default-avatar.png',
        phone: this.data.phone
      };

      // 保存登录状态
      wx.setStorageSync('token', mockUserData.token);
      wx.setStorageSync('userInfo', mockUserData);
      wx.setStorageSync('loginType', 'phone');

      this.setData({
        isAuthenticated: true,
        userInfo: mockUserData
      });

      wx.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 1500
      });

      // 登录成功后的事件
      this.onLoginSuccess(mockUserData);
    }, 1500);
  },

  // 协议选择
  onAgreementChange(e) {
    const agreed = e.detail.value.includes('agreed');
    const canLogin = this.validatePhone(this.data.phone) && 
                     this.data.code.length === 6 && 
                     agreed;
    
    this.setData({
      agreed,
      canLogin
    });
  },

  // 显示服务协议
  showAgreement() {
    wx.showModal({
      title: '服务协议',
      content: '这里是校友会小程序的服务协议内容...',
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  // 显示隐私政策
  showPrivacy() {
    wx.showModal({
      title: '隐私政策',
      content: '这里是校友会小程序的隐私政策内容...',
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  // 登录成功处理
  onLoginSuccess(userData) {
    // 触发全局登录事件
    const app = getApp();
    if (app && app.onLoginSuccess) {
      app.onLoginSuccess(userData);
    }

    // 可以跳转到首页或返回上一页
    setTimeout(() => {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        wx.navigateBack();
      } else {
        wx.switchTab({
          url: '/pages/index/index'
        });
      }
    }, 1000);
  },

  // 进入首页
  goToHome() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除本地存储
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
          wx.removeStorageSync('loginType');

          this.setData({
            isAuthenticated: false,
            userInfo: null,
            phone: '',
            code: ''
          });

          // 触发全局退出事件
          const app = getApp();
          if (app && app.onLogout) {
            app.onLogout();
          }

          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          });
        }
      }
    });
  },

  // 游客体验
  enterAsGuest() {
    wx.showModal({
      title: '游客模式',
      content: '游客模式功能受限，部分功能需要登录后才能使用。确定以游客身份进入吗？',
      success: (res) => {
        if (res.confirm) {
          // 设置游客标识
          wx.setStorageSync('isGuest', true);
          
          // 跳转到首页
          wx.switchTab({
            url: '/pages/index/index'
          });
        }
      }
    });
  }
});