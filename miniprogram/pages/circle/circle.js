// pages/circle/circle.js
Page({
  data: {
    // 当前标签页：0=动态，1=活动，2=查找
    currentTab: 0,
    
    // 显示发布弹窗
    showModal: false,
    
    // 动态数据
    posts: [
      {
        id: 1,
        avatar: '/images/default-avatar.png',
        name: '张三',
        grade: '2015级',
        major: '计算机科学',
        time: '2小时前',
        content: '今天参加了校友会活动，收获很大！',
        likes: 24,
        comments: 8
      },
      {
        id: 2,
        avatar: '/images/default-avatar.png',
        name: '李四',
        grade: '2018级',
        major: '软件工程',
        time: '5小时前',
        content: '寻找在北京的校友一起创业！',
        likes: 36,
        comments: 12
      }
    ],
    
    // 活动数据
    activities: [
      {
        id: 1,
        type: '线上讲座',
        title: '人工智能前沿技术分享',
        date: '2024-03-15',
        time: '19:30-21:00',
        location: '腾讯会议'
      },
      {
        id: 2,
        type: '线下聚会',
        title: '北京校友春季茶话会',
        date: '2024-03-20',
        time: '14:00-17:00',
        location: '海淀咖啡厅'
      }
    ],
    
    // 校友数据
    alumni: [
      {
        id: 1,
        avatar: '/images/default-avatar.png',
        name: '王五',
        grade: '2016级',
        major: '电子信息',
        location: '上海'
      },
      {
        id: 2,
        avatar: '/images/default-avatar.png',
        name: '赵六',
        grade: '2019级',
        major: '工商管理',
        location: '深圳'
      }
    ],
    
    // 年级选项
    grades: ['2015级', '2016级', '2017级', '2018级', '2019级', '2020级']
  },

  onLoad() {
    console.log('校友圈页面加载');
  },

  onPullDownRefresh() {
    console.log('下拉刷新');
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  },

  // ========== 关键方法 ==========
  // 切换标签页 - 这里的方法名必须和 WXML 中的 bindtap 一致
  changeTab(e) {
    console.log('切换标签页');
    const tab = e.currentTarget.dataset.tab;
    
    if (tab !== undefined) {
      this.setData({
        currentTab: parseInt(tab)
      });
      console.log('当前标签页:', this.data.currentTab);
    }
  },

  // ========== 其他方法 ==========
  goToSearch() {
    wx.showToast({
      title: '搜索功能',
      icon: 'none'
    });
  },

  // 显示发布弹窗
  showPublishModal() {
    this.setData({
      showModal: true
    });
  },

  // 隐藏弹窗
  hideModal() {
    this.setData({
      showModal: false
    });
  },

  // 提交发布
  submitPost() {
    wx.showToast({
      title: '发布成功',
      icon: 'success'
    });
    this.hideModal();
  },

  // 点赞
  likePost(e) {
    const id = e.currentTarget.dataset.id;
    const posts = this.data.posts.map(post => {
      if (post.id === id) {
        post.likes += 1;
      }
      return post;
    });
    
    this.setData({ posts });
    
    wx.showToast({
      title: '已点赞',
      icon: 'success'
    });
  },

  // 评论
  commentPost() {
    wx.showToast({
      title: '评论功能',
      icon: 'none'
    });
  },

  // 分享
  sharePost() {
    wx.showToast({
      title: '分享功能',
      icon: 'none'
    });
  },

  // 报名活动
  joinActivity(e) {
    const id = e.currentTarget.dataset.id;
    wx.showToast({
      title: '报名成功',
      icon: 'success'
    });
  },

  // 年级选择
  onGradeChange(e) {
    console.log('选择年级:', this.data.grades[e.detail.value]);
  },

  // 发送私信
  sendMessage() {
    wx.showToast({
      title: '私信功能',
      icon: 'none'
    });
  }
});