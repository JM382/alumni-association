// pages/circle/circle.js
Page({
  data: {
    // 0=动态 1=活动 2=找校友
    currentTab: 0,

    // 动态列表
    posts: [],

    // 找校友筛选
    schoolOptions: [
      '全部',
      '国防科技大学',
      '哈尔滨工程大学',
      '南京理工大学',
      '西北工业大学',
      '陆军工程大学',
      '陆军兵种大学',
      '陆军防化学院',
      '海军工程大学',
      '空军工程大学',
      '中航工业空气动力研究院'
    ],
    majorOptions: ['全部', '计算机科学与技术', '软件工程', '通信工程', '自动化', '其他'],
    gradeOptions: [
      '全部',
      '2000级','2001级','2002级','2003级','2004级','2005级','2006级','2007级',
      '2008级','2009级','2010级','2011级','2012级','2013级','2014级','2015级',
      '2016级','2017级','2018级','2019级','2020级','2021级','2022级','2023级','2024级'
    ],
    currentSchoolIndex: 0,
    currentMajorIndex: 0,
    currentGradeIndex: 0,
    alumniList: [],
  },

  // 点击头像 / 校友卡片，跳转到个人主页
  onTapUser(e) {
    const userId = e.currentTarget.dataset.userId;
    if (!userId) return;
    wx.navigateTo({
      url: `/pages/me/user-profile/user-profile?userId=${userId}`,
    });
  },

  onLoad() {
    this.fetchPosts();
  },

  onShow() {
    // 从发布页返回时刷新动态
    if (this.data.currentTab === 0) {
      this.fetchPosts();
    }
  },

  onPullDownRefresh() {
    const tab = this.data.currentTab;
    const p = tab === 0 ? this.fetchPosts() : tab === 2 ? this.fetchAlumni() : Promise.resolve();
    p.finally(() => wx.stopPullDownRefresh());
  },

  // 顶部三个切换键
  onChangeTab(e) {
    const tab = Number(e.currentTarget.dataset.tab);
    if (Number.isNaN(tab)) return;
    this.setData({ currentTab: tab });
    if (tab === 0) {
      this.fetchPosts();
    } else if (tab === 2) {
      this.fetchAlumni();
    }
  },

  // 跳转到发布动态页
  onGoPublish() {
    wx.navigateTo({
      url: '/pages/circle/publish/publish',
    });
  },

  // 互动历史占位
  onViewInteractions() {
    wx.showToast({
      title: '互动历史稍后接入',
      icon: 'none',
    });
  },

  // 点赞
  onToggleLike(e) {
    const postId = e.currentTarget.dataset.id;
    if (!postId) return;
    wx.cloud
      .callFunction({
        name: 'circle',
        data: {
          action: 'toggleLike',
          postId,
        },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '操作失败', icon: 'none' });
          return;
        }
        const liked = result.liked;
        const posts = this.data.posts.map((p) => {
          if (p._id === postId) {
            const next = { ...p };
            next.hasLiked = liked;
            next.likeCount = (next.likeCount || 0) + (liked ? 1 : -1);
            if (next.likeCount < 0) next.likeCount = 0;
            return next;
          }
          return p;
        });
        this.setData({ posts });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '操作失败', icon: 'none' });
      });
  },

  // 评论占位
  onCommentTodo() {
    wx.showToast({
      title: '评论功能稍后接入',
      icon: 'none',
    });
  },

  // 从云函数获取动态列表
  fetchPosts() {
    return wx.cloud
      .callFunction({
        name: 'circle',
        data: {
          action: 'listPosts',
          page: 1,
          pageSize: 20,
        },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '加载失败', icon: 'none' });
          return;
        }
        const list = (result.list || []).map((item) => {
          const d = item.createdAt ? new Date(item.createdAt) : null;
          let timeText = '';
          if (d && !Number.isNaN(d.getTime())) {
            const now = Date.now();
            const diff = now - d.getTime();
            const oneHour = 60 * 60 * 1000;
            const oneDay = 24 * oneHour;
            if (diff < oneHour) {
              timeText = '刚刚';
            } else if (diff < oneDay) {
              const hours = Math.floor(diff / oneHour);
              timeText = `${hours}小时前`;
            } else {
              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              timeText = `${y}-${m}-${day}`;
            }
          }
          return {
            ...item,
            timeText,
          };
        });
        this.setData({ posts: list });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      });
  },

  // ===== 找校友筛选 =====
  onSchoolChange(e) {
    const index = Number(e.detail.value);
    this.setData({ currentSchoolIndex: index }, () => this.fetchAlumni());
  },

  onMajorChange(e) {
    const index = Number(e.detail.value);
    this.setData({ currentMajorIndex: index }, () => this.fetchAlumni());
  },

  onGradeChange(e) {
    const index = Number(e.detail.value);
    this.setData({ currentGradeIndex: index }, () => this.fetchAlumni());
  },

  fetchAlumni() {
    const {
      schoolOptions,
      majorOptions,
      gradeOptions,
      currentSchoolIndex,
      currentMajorIndex,
      currentGradeIndex,
    } = this.data;

    const schoolName =
      currentSchoolIndex > 0 ? schoolOptions[currentSchoolIndex] : '';
    const major = currentMajorIndex > 0 ? majorOptions[currentMajorIndex] : '';
    const gradeLabel =
      currentGradeIndex > 0 ? gradeOptions[currentGradeIndex] : '';
    const enterYear = gradeLabel
      ? parseInt(gradeLabel.replace('级', ''), 10)
      : '';

    return wx.cloud
      .callFunction({
        name: 'searchAlumni',
        data: {
          schoolName,
          major,
          enterYear,
          page: 1,
          pageSize: 30,
        },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '查询失败', icon: 'none' });
          return;
        }
        this.setData({ alumniList: result.list || [] });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '查询失败', icon: 'none' });
      });
  },
});

// pages/circle/circle.js
Page({
  data: {
    // 当前标签页：0=动态 1=活动 2=找校友（当前只实现动态）
    currentTab: 0,
    posts: [],
  },

  onLoad() {
    this.fetchPosts();
  },

  onShow() {
    this.fetchPosts();
  },

  onPullDownRefresh() {
    this.fetchPosts().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 顶部三个切换键
  onChangeTab(e) {
    const tab = Number(e.currentTarget.dataset.tab);
    if (Number.isNaN(tab)) return;
    this.setData({ currentTab: tab });
    if (tab === 0) {
      this.fetchPosts();
    }
  },

  // 跳转到发布动态页
  onGoPublish() {
    wx.navigateTo({
      url: '/pages/circle/publish/publish',
    });
  },

  // 互动历史占位（后续可接入 notifications 云函数）
  onViewInteractions() {
    wx.showToast({
      title: '互动历史稍后接入',
      icon: 'none',
    });
  },

  // 点赞
  onToggleLike(e) {
    const postId = e.currentTarget.dataset.id;
    if (!postId) return;
    wx.cloud
      .callFunction({
        name: 'circle',
        data: {
          action: 'toggleLike',
          postId,
        },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '操作失败', icon: 'none' });
          return;
        }
        const liked = result.liked;
        const posts = this.data.posts.map((p) => {
          if (p._id === postId) {
            const next = { ...p };
            next.hasLiked = liked;
            next.likeCount = (next.likeCount || 0) + (liked ? 1 : -1);
            if (next.likeCount < 0) next.likeCount = 0;
            return next;
          }
          return p;
        });
        this.setData({ posts });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '操作失败', icon: 'none' });
      });
  },

  // 评论占位
  onCommentTodo() {
    wx.showToast({
      title: '评论功能稍后接入',
      icon: 'none',
    });
  },

  // 从云函数获取动态列表
  fetchPosts() {
    return wx.cloud
      .callFunction({
        name: 'circle',
        data: {
          action: 'listPosts',
          page: 1,
          pageSize: 20,
        },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '加载失败', icon: 'none' });
          return;
        }
        const list = (result.list || []).map((item) => {
          const d = item.createdAt ? new Date(item.createdAt) : null;
          let timeText = '';
          if (d && !Number.isNaN(d.getTime())) {
            const now = Date.now();
            const diff = now - d.getTime();
            const oneHour = 60 * 60 * 1000;
            const oneDay = 24 * oneHour;
            if (diff < oneHour) {
              timeText = '刚刚';
            } else if (diff < oneDay) {
              const hours = Math.floor(diff / oneHour);
              timeText = `${hours}小时前`;
            } else {
              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              timeText = `${y}-${m}-${day}`;
            }
          }
          return {
            ...item,
            timeText,
          };
        });
        this.setData({ posts: list });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      });
  },
});

// pages/circle/circle.js
Page({
  data: {
    // 0=动态 1=活动 2=找校友（当前只实现动态）
    currentTab: 0,
    posts: [],
  },

  onLoad() {
    this.fetchPosts();
  },

  onShow() {
    // 返回页面时刷新一次，方便看到刚发布的动态
    this.fetchPosts();
  },

  // 顶部三个切换键
  onChangeTab(e) {
    const tab = Number(e.currentTarget.dataset.tab);
    if (Number.isNaN(tab)) return;
    this.setData({ currentTab: tab });
    if (tab === 0) {
      this.fetchPosts();
    }
  },

  onPullDownRefresh() {
    this.fetchPosts().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 跳转到发布动态页
  onGoPublish() {
    wx.navigateTo({
      url: '/pages/circle/publish/publish',
    });
  },

  // 互动历史占位（后续可接入 notifications 云函数）
  onViewInteractions() {
    wx.showToast({
      title: '互动历史稍后接入',
      icon: 'none',
    });
  },

  // 点赞
  onToggleLike(e) {
    const postId = e.currentTarget.dataset.id;
    if (!postId) return;
    wx.cloud
      .callFunction({
        name: 'circle',
        data: {
          action: 'toggleLike',
          postId,
        },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '操作失败', icon: 'none' });
          return;
        }
        const liked = result.liked;
        const posts = this.data.posts.map((p) => {
          if (p._id === postId) {
            const next = { ...p };
            next.hasLiked = liked;
            next.likeCount = (next.likeCount || 0) + (liked ? 1 : -1);
            if (next.likeCount < 0) next.likeCount = 0;
            return next;
          }
          return p;
        });
        this.setData({ posts });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '操作失败', icon: 'none' });
      });
  },

  // 评论占位
  onCommentTodo() {
    wx.showToast({
      title: '评论功能稍后接入',
      icon: 'none',
    });
  },

  // 从云函数获取动态列表
  fetchPosts() {
    return wx.cloud
      .callFunction({
        name: 'circle',
        data: {
          action: 'listPosts',
          page: 1,
          pageSize: 20,
        },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '加载失败', icon: 'none' });
          return;
        }
        const list = (result.list || []).map((item) => {
          const d = item.createdAt ? new Date(item.createdAt) : null;
          let timeText = '';
          if (d && !Number.isNaN(d.getTime())) {
            const now = Date.now();
            const diff = now - d.getTime();
            const oneHour = 60 * 60 * 1000;
            const oneDay = 24 * oneHour;
            if (diff < oneHour) {
              timeText = '刚刚';
            } else if (diff < oneDay) {
              const hours = Math.floor(diff / oneHour);
              timeText = `${hours}小时前`;
            } else {
              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              timeText = `${y}-${m}-${day}`;
            }
          }
          return {
            ...item,
            timeText,
          };
        });
        this.setData({ posts: list });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      });
  },
});

// pages/circle/circle.js
Page({
  data: {
    // 当前标签页：0=动态，1=活动，2=查找
    currentTab: 0,

    // 显示发布弹窗
    showModal: false,

    // 发布内容和媒体
    newPostContent: '',
    newPostMedia: [], // {type: 'image' | 'video', src: string}

    // 动态数据（从云函数 circle 获取）
    posts: [],

    // 活动数据（暂时保留静态，后续接入 events 云函数）
    activities: [
      {
        id: 1,
        type: '线上讲座',
        title: '人工智能前沿技术分享',
        date: '2024-03-15',
        time: '19:30-21:00',
        location: '腾讯会议',
      },
      {
        id: 2,
        type: '线下聚会',
        title: '北京校友春季茶话会',
        date: '2024-03-20',
        time: '14:00-17:00',
        location: '海淀咖啡厅',
      },
    ],

    // 校友数据（后续接入 alumniSearch 云函数）
    alumni: [],

    // 年级选项（后续可根据 users.enterYear 自动生成）
    grades: ['2015级', '2016级', '2017级', '2018级', '2019级', '2020级'],
  },

  onLoad() {
    this.fetchPosts();
  },

  onPullDownRefresh() {
    this.fetchPosts().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  // ========== 关键方法 ==========
  // 切换标签页 - 这里的方法名必须和 WXML 中的 bindtap 一致
  changeTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab !== undefined) {
      this.setData({
        currentTab: parseInt(tab, 10),
      });
      if (this.data.currentTab === 0) {
        this.fetchPosts();
      }
    }
  },

  // ========== 其他方法 ==========
  goToSearch() {
    wx.showToast({
      title: '搜索功能',
      icon: 'none',
    });
  },

  // 显示发布弹窗
  showPublishModal() {
    this.setData({
      showModal: true,
    });
  },

  // 隐藏弹窗
  hideModal() {
    this.setData({
      showModal: false,
    });
  },

  onPublishInput(e) {
    this.setData({ newPostContent: e.detail.value });
  },

  onChooseMedia() {
    const that = this;
    wx.showActionSheet({
      itemList: ['图片', '视频'],
      success(res) {
        const tapIndex = res.tapIndex;
        if (tapIndex === 0) {
          wx.chooseImage({
            count: 9 - that.data.newPostMedia.length,
            sizeType: ['compressed'],
            success(r) {
              const list = (r.tempFilePaths || []).map((p) => ({ type: 'image', src: p }));
              that.setData({ newPostMedia: that.data.newPostMedia.concat(list) });
            },
          });
        } else if (tapIndex === 1) {
          wx.chooseVideo({
            sourceType: ['album', 'camera'],
            maxDuration: 60,
            success(r) {
              that.setData({ newPostMedia: [{ type: 'video', src: r.tempFilePath }] });
            },
          });
        }
      },
    });
  },

  onRemoveMedia(e) {
    const idx = e.currentTarget.dataset.index;
    const list = this.data.newPostMedia.slice();
    list.splice(idx, 1);
    this.setData({ newPostMedia: list });
  },

  // 提交发布（调用云函数 circle.createPost）
  submitPost() {
    const content = (this.data.newPostContent || '').trim();
    if (!content) {
      wx.showToast({ title: '请输入内容', icon: 'none' });
      return;
    }
    // 这里先只提交文本，媒体上传后续再接云存储
    wx.cloud
      .callFunction({
        name: 'circle',
        data: {
          action: 'createPost',
          content,
          images: [],
        },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '发布失败', icon: 'none' });
          return;
        }
        wx.showToast({ title: '发布成功', icon: 'success' });
        this.setData({ newPostContent: '', showModal: false });
        this.fetchPosts();
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '发布失败', icon: 'none' });
      });
  },

  // 点赞（调用云函数 circle.toggleLike）
  likePost(e) {
    const postId = e.currentTarget.dataset.id;
    wx.cloud
      .callFunction({
        name: 'circle',
        data: {
          action: 'toggleLike',
          postId,
        },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '操作失败', icon: 'none' });
          return;
        }
        const liked = result.liked;
        const posts = this.data.posts.map((p) => {
          if (p._id === postId) {
            const next = { ...p };
            next.hasLiked = liked;
            next.likeCount = (next.likeCount || 0) + (liked ? 1 : -1);
            if (next.likeCount < 0) next.likeCount = 0;
            return next;
          }
          return p;
        });
        this.setData({ posts });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '操作失败', icon: 'none' });
      });
  },

  // 评论（后续接入评论功能）
  commentPost() {
    wx.showToast({
      title: '评论功能开发中',
      icon: 'none',
    });
  },

  // 分享
  sharePost() {
    wx.showToast({
      title: '分享功能开发中',
      icon: 'none',
    });
  },

  // 报名活动（后续接入 events 云函数）
  joinActivity() {
    wx.showToast({
      title: '报名功能开发中',
      icon: 'none',
    });
  },

  // 年级选择（后续用于校友查找筛选）
  onGradeChange(e) {
    const grade = this.data.grades[e.detail.value];
    console.log('选择年级:', grade);
  },

  // 发送私信（后续接入私信模块）
  sendMessage() {
    wx.showToast({
      title: '私信功能开发中',
      icon: 'none',
    });
  },

  // 从云函数获取动态列表
  fetchPosts() {
    return wx.cloud
      .callFunction({
        name: 'circle',
        data: {
          action: 'listPosts',
          page: 1,
          pageSize: 20,
        },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '加载失败', icon: 'none' });
          return;
        }
        const list = (result.list || []).map((item) => {
          const d = item.createdAt ? new Date(item.createdAt) : null;
          let timeText = '';
          if (d && !Number.isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            timeText = `${y}-${m}-${day}`;
          }
          return {
            ...item,
            timeText,
          };
        });
        this.setData({ posts: list });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      });
  },
});