// 个人中心 - 红色顶栏 + 功能网格 + 设置列表
Page({
  data: {
    statusBarHeight: 20,
    // 个人中心展示的用户信息，进入页面时通过 getUserInfo 云函数从 users 集合加载
    userInfo: null,
    gridItems: [
      { icon: 'https://636c-cloud1-7g1x07md7360212c-1406143873.tcb.qcloud.la/me/%E5%8D%A1%E5%8C%85.png?sign=0921c1138e5f9da00ccd5d5f23f1486a&t=1773143008', label: '卡包', method: 'goToCardPackage' },
      { icon: 'https://636c-cloud1-7g1x07md7360212c-1406143873.tcb.qcloud.la/me/%E7%A7%AF%E5%88%86.png?sign=872bd4a5cfac71df5d90834e29e4020a&t=1773143044', label: '积分', method: 'goToPoints' },
      { icon: 'https://636c-cloud1-7g1x07md7360212c-1406143873.tcb.qcloud.la/me/%E9%80%9A%E8%AE%AF%E5%BD%95.png?sign=68a3c698e3d04e506779b9572f8548b2&t=1773143061', label: '通讯录', method: 'goToContacts' },
      { icon: 'https://636c-cloud1-7g1x07md7360212c-1406143873.tcb.qcloud.la/me/%E6%88%91%E7%9A%84%E6%B4%BB%E5%8A%A8.png?sign=0edd063f38a68fbb76653012c4fa8578&t=1773143078', label: '我的活动', method: 'goToActivities' },
      { icon: 'https://636c-cloud1-7g1x07md7360212c-1406143873.tcb.qcloud.la/me/%E6%88%91%E7%9A%84%E8%AE%A2%E5%8D%95.png?sign=a9bcbb1fa50b2403f10f62834b8de62e&t=1773143098', label: '我的订单', method: 'goToOrders' },
      { icon: 'https://636c-cloud1-7g1x07md7360212c-1406143873.tcb.qcloud.la/me/%E6%8D%90%E8%B5%A0.png?sign=fbd3c582332fd0505eeddf992e81a516&t=1773143111', label: '我的捐赠', method: 'goToDonations' },
      { icon: 'https://636c-cloud1-7g1x07md7360212c-1406143873.tcb.qcloud.la/me/%E6%89%BE%E4%BA%BA%E8%84%89.png?sign=6627c61c02ad8f3cdb8bd88ff13ea9c7&t=1773143129', label: '找人脉', method: 'goToConnections' },
      { icon: 'https://636c-cloud1-7g1x07md7360212c-1406143873.tcb.qcloud.la/me/%E8%B5%84%E6%BA%90%E6%B1%82%E5%8A%A9.png?sign=566b95982d25f6d8dc066edbb2c3281f&t=1773143145', label: '资源求助', method: 'goToResources' },
      { icon: 'https://636c-cloud1-7g1x07md7360212c-1406143873.tcb.qcloud.la/me/%E5%8F%91%E5%B8%83.png?sign=65a3cf4299189fa8fe849885af8f48ab&t=1773143162', label: '资源发布', method: 'goToPublish' },
      { icon: 'https://636c-cloud1-7g1x07md7360212c-1406143873.tcb.qcloud.la/me/%E4%B8%AA%E4%BA%BA%E4%BF%A1%E6%81%AF.png?sign=596c65e30c90894cab506c90376cc0f2&t=1773143173', label: '个人信息', method: 'goToProfile' },
      { icon: 'https://636c-cloud1-7g1x07md7360212c-1406143873.tcb.qcloud.la/me/%E8%AE%A4%E8%AF%81.png?sign=96c6a28e625104e46d01f1e086979c07&t=1773143188', label: '认证与申请', method: 'goToAuth' },
      { icon: 'https://636c-cloud1-7g1x07md7360212c-1406143873.tcb.qcloud.la/me/%E4%BC%9A%E5%91%98%E4%B8%AD%E5%BF%83.png?sign=9de56cfafe09670adb7a760d53ee360c&t=1773144152', label: '会员中心', method: 'goToMembership' },
    ],
    settingItems: [
      { icon: 'https://636c-cloud1-7g1x07md7360212c-1406143873.tcb.qcloud.la/me/%E8%B4%A6%E5%8F%B7%E8%AE%BE%E7%BD%AE.png?sign=7f7e7caa16b5f0bd4fa2e19735dbac63&t=1773143217', label: '账号设置', method: 'goToAccountSettings' },
      { icon: 'https://636c-cloud1-7g1x07md7360212c-1406143873.tcb.qcloud.la/me/%E6%B6%88%E6%81%AF%E9%80%9A%E7%9F%A5.png?sign=f052fd8a248208d99097130b6c2000bf&t=1773143237', label: '消息通知', method: 'goToNotification' },
      { icon: 'https://636c-cloud1-7g1x07md7360212c-1406143873.tcb.qcloud.la/me/%E9%9A%90%E7%A7%81%E8%AE%BE%E7%BD%AE.png?sign=f3ef0d163158cbaaefb5558a2af6823b&t=1773143255', label: '隐私设置', method: 'goToPrivacy' },
      { icon: 'https://636c-cloud1-7g1x07md7360212c-1406143873.tcb.qcloud.la/me/%E5%B8%AE%E5%8A%A9%E4%B8%AD%E5%BF%83.png?sign=a756a5b82e111f484005c8c2ef290aa2&t=1773143269', label: '帮助中心', method: 'goToHelp' },
      { icon: 'https://636c-cloud1-7g1x07md7360212c-1406143873.tcb.qcloud.la/me/%E5%85%B3%E4%BA%8E%E6%88%91%E4%BB%AC.png?sign=89a1d530df2af6befc02cae518b864c3&t=1773143283', label: '关于我们', method: 'goToAbout' },
    ],
  },

  onLoad() {
    if (wx.getWindowInfo) {
      const info = wx.getWindowInfo();
      this.setData({
        statusBarHeight: info.statusBarHeight || 20,
      });
    } else {
      const sys = wx.getSystemInfoSync();
      this.setData({
        statusBarHeight: sys.statusBarHeight || 20,
      });
    }
  },

  onShow() {
    this.loadUserInfo();
  },

  loadUserInfo() {
    wx.cloud
      .callFunction({
        name: 'getUserInfo',
      })
      .then((res) => {
        const result = res.result || {};
        if (result.code !== 0 || !result.data) {
          console.warn('getUserInfo 返回异常', result);
          this.setData({
            userInfo: {
              nickName: '微信用户',
              avatarUrl: '',
              schoolName: '',
            },
          });
          return;
        }
        const data = result.data;
        this.setData({
          userInfo: {
            nickName: data.nickname || data.nickName || '微信用户',
            avatarUrl: data.avatarUrl || '',
            schoolName: data.schoolName || '',
          },
        });
      })
      .catch((err) => {
        console.error('调用 getUserInfo 失败', err);
        this.setData({
          userInfo: {
            nickName: '微信用户',
            avatarUrl: '',
            schoolName: '计算机与信息工程学院',
          },
        });
      });
  },

  onAvatarError() {
    this.setData({
      'userInfo.avatarUrl': '',
    });
  },

  onMoreTap() {
    wx.showActionSheet({
      itemList: ['分享个人页', '反馈'],
      success: (res) => {
        wx.showToast({ title: '功能开发中', icon: 'none' });
      },
    });
  },

  onSettingsTap() {
    this.goToAccountSettings();
  },

  onGridTap(e) {
    const method = e.currentTarget.dataset.method;
    if (method && this[method]) this[method]();
  },
  onSettingTap(e) {
    const method = e.currentTarget.dataset.method;
    if (method && this[method]) this[method]();
  },

  goToCardPackage() {
    wx.navigateTo({ url: '/pages/me/card/card' });
  },
  goToPoints() {
    wx.navigateTo({ url: '/pages/me/points/points' });
  },
  goToContacts() {
    wx.navigateTo({ url: '/pages/me/contacts/contacts' });
  },
  goToActivities() {
    wx.navigateTo({ url: '/pages/me/my-activities/my-activities' });
  },
  goToOrders() {
    wx.navigateTo({ url: '/pages/me/my-orders/my-orders' });
  },
  goToDonations() {
    wx.navigateTo({ url: '/pages/me/my-donations/my-donations' });
  },
  goToConnections() {
    wx.navigateTo({ url: '/pages/me/connections/connections' });
  },
  goToResources() {
    wx.navigateTo({ url: '/pages/me/resource-help/resource-help' });
  },
  goToPublish() {
    wx.navigateTo({ url: '/pages/me/resource-publish/resource-publish' });
  },
  goToProfile() {
    wx.navigateTo({ url: '/pages/me/profile/profile' });
  },
  goToAuth() {
    wx.navigateTo({ url: '/pages/me/auth/auth' });
  },
  goToMembership() {
    wx.navigateTo({ url: '/pages/me/membership/membership' });
  },

  goToAccountSettings() {
    wx.navigateTo({ url: '/pages/me/account-settings/account-settings' });
  },
  goToNotification() {
    wx.navigateTo({ url: '/pages/me/notification-settings/notification-settings' });
  },
  goToPrivacy() {
    wx.navigateTo({ url: '/pages/me/privacy-settings/privacy-settings' });
  },
  goToHelp() {
    wx.navigateTo({ url: '/pages/me/help-center/help-center' });
  },
  goToAbout() {
    wx.navigateTo({ url: '/pages/me/about-us/about-us' });
  },
});
