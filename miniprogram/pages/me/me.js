// pages/my/my.js
Page({
  data: {
    // 用户信息
    userInfo: {
      name: '黄今慧',
      status: '游客',
      alumniNo: 'No.2024010001',
      school: '北京工商大学',
      enrollmentYear: '2010年',
      college: '计算机与信息工程学院',
      avatarUrl: '../../images/default-avatar.png'
    },
    
    // 统计数据
    stats: {
      points: 0,
      activities: 0,
      contacts: 0
    },
    
    // 设置开关
    notificationEnabled: true,
    
    // 功能图标路径（根据你的实际路径调整）
    icons: {
      card: '../../icons/card.png',
      points: '../../icons/points.png',
      contacts: '../../icons/contacts.png',
      activity: '../../icons/activity.png',
      order: '../../icons/order.png',
      donation: '../../icons/donation.png',
      connection: '../../icons/connection.png',
      resource: '../../icons/resource.png',
      publish: '../../icons/publish.png',
      profile: '../../icons/profile.png',
      friend: '../../icons/friend.png',
      map: '../../icons/map.png',
      display: '../../icons/display.png',
      restaurant: '../../icons/restaurant.png',
      arrowRight: '../../icons/arrow-right.png'
    }
  },

  onLoad() {
    this.loadUserData();
  },

  onPullDownRefresh() {
    console.log('下拉刷新');
    this.loadUserData();
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  },

  loadUserData() {
    // 模拟加载用户数据
    console.log('加载用户数据...');
    // TODO: 这里可以添加实际的API调用
  },

  // 查看电子校友卡
  viewAlumniCard() {
    wx.showToast({
      title: '查看校友卡',
      icon: 'none'
    });
    // TODO: 跳转到校友卡详情页面
    // wx.navigateTo({
    //   url: '/pages/alumni-card/alumni-card'
    // });
  },

  // 分享校友卡
  shareAlumniCard() {
    wx.showToast({
      title: '分享功能',
      icon: 'none'
    });
    // TODO: 实现分享功能
  },

  // 跳转到积分页面
  goToPoints() {
    wx.showToast({
      title: '积分页面',
      icon: 'none'
    });
    // wx.navigateTo({
    //   url: '/pages/points/points'
    // });
  },

  // 跳转到活动页面
  goToEvents() {
    wx.showToast({
      title: '我的活动',
      icon: 'none'
    });
    // wx.navigateTo({
    //   url: '/pages/events/events'
    // });
  },

  // 跳转到通讯录
  goToContacts() {
    wx.showToast({
      title: '通讯录',
      icon: 'none'
    });
    // wx.navigateTo({
    //   url: '/pages/contacts/contacts'
    // });
  },

  // 其他功能跳转方法
  goToCardPackage() {
    this.showComingSoon('卡包功能');
  },

  goToActivities() {
    this.showComingSoon('我的活动');
  },

  goToOrders() {
    this.showComingSoon('我的订单');
  },

  goToDonations() {
    this.showComingSoon('我的捐赠');
  },

  goToConnections() {
    this.showComingSoon('找人脉');
  },

  goToResources() {
    this.showComingSoon('资源求助');
  },

  goToPublish() {
    this.showComingSoon('资源发布');
  },

  goToProfile() {
    wx.navigateTo({
      url: '/pages/profile/profile'
    });
  },

  goToFriends() {
    this.showComingSoon('身边好友');
  },

  goToMap() {
    this.showComingSoon('企业地图');
  },

  goToSelfDisplay() {
    this.showComingSoon('自我展示');
  },

  goToHunanRestaurant() {
    this.showComingSoon('找湘菜馆');
  },

  // 设置相关跳转
  goToAccountSettings() {
    this.showComingSoon('账号设置');
  },

  goToNotification() {
    this.showComingSoon('消息通知设置');
  },

  goToPrivacy() {
    this.showComingSoon('隐私设置');
  },

  goToHelp() {
    this.showComingSoon('帮助中心');
  },

  goToAbout() {
    this.showComingSoon('关于我们');
  },

  // 切换通知开关
  toggleNotification(e) {
    this.setData({
      notificationEnabled: e.detail.value
    });
    wx.showToast({
      title: e.detail.value ? '通知已开启' : '通知已关闭',
      icon: 'success'
    });
  },

  // 通用提示方法
  showComingSoon(feature) {
    wx.showToast({
      title: `${feature} 开发中`,
      icon: 'none',
      duration: 2000
    });
  },

  // 用户点击头像
  onAvatarTap() {
    wx.showActionSheet({
      itemList: ['更换头像', '查看大图'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.changeAvatar();
        } else if (res.tapIndex === 1) {
          this.previewAvatar();
        }
      }
    });
  },

  changeAvatar() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        this.setData({
          'userInfo.avatarUrl': tempFilePath
        });
        wx.showToast({
          title: '头像更新成功',
          icon: 'success'
        });
      }
    });
  },

  previewAvatar() {
    wx.previewImage({
      urls: [this.data.userInfo.avatarUrl]
    });
  }
});