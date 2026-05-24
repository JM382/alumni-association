// pages/circle/circle.js
Page({
  data: {
    // 0=动态 1=活动 2=找校友
    currentTab: 0,

    // 动态列表
    posts: [],

    // 活动列表
    activities: [],

    // 找校友筛选（默认全部）
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
      '中航工业空气动力研究院',
    ],
    majorOptions: ['全部', '计算机科学与技术', '软件工程', '通信工程', '自动化', '其他'],
    gradeOptions: [
      '全部',
      '2000级',
      '2001级',
      '2002级',
      '2003级',
      '2004级',
      '2005级',
      '2006级',
      '2007级',
      '2008级',
      '2009级',
      '2010级',
      '2011级',
      '2012级',
      '2013级',
      '2014级',
      '2015级',
      '2016级',
      '2017级',
      '2018级',
      '2019级',
      '2020级',
      '2021级',
      '2022级',
      '2023级',
      '2024级',
    ],
    currentSchoolIndex: 0,
    currentMajorIndex: 0,
    currentGradeIndex: 0,
    alumniList: [],

    // 底部选择器（自定义，支持大量选项）
    pickerVisible: false,
    pickerType: '', // school | grade | major
    pickerTitle: '',
    pickerItems: [],
  },

  onLoad() {
    this.fetchPosts();
    this.fetchActivities();
  },

  onShow() {
    if (this.data.currentTab === 0) this.fetchPosts();
  },

  onPullDownRefresh() {
    const tab = this.data.currentTab;
    const p =
      tab === 0
        ? this.fetchPosts()
        : tab === 1
          ? this.fetchActivities()
          : tab === 2
            ? this.fetchAlumni()
            : Promise.resolve();
    p.finally(() => wx.stopPullDownRefresh());
  },

  // 顶部三个切换键
  onChangeTab(e) {
    const tab = Number(e.currentTarget.dataset.tab);
    if (Number.isNaN(tab)) return;
    if (tab === this.data.currentTab) return;
    this.setData({ currentTab: tab });
    if (tab === 0) this.fetchPosts();
    if (tab === 1) this.fetchActivities();
    if (tab === 2) this.fetchAlumni();
  },

  // 点击头像 / 校友卡片，跳转到个人主页
  onTapUser(e) {
    const userId = e.currentTarget.dataset.userId;
    if (!userId) return;
    wx.navigateTo({ url: `/pages/me/user-profile/user-profile?userId=${userId}` });
  },

  // 跳转到发布动态页
  onGoPublish() {
    wx.navigateTo({ url: '/pages/circle/publish/publish' });
  },

  // 互动历史
  onViewInteractions() {
    wx.navigateTo({ url: '/pages/circle/interactions/interactions' });
  },

  // 动态详情（评论页）
  onGoPostDetail(e) {
    const postId = e.currentTarget.dataset.id;
    if (!postId) return;
    wx.navigateTo({ url: `/pages/circle/post-detail/post-detail?postId=${postId}` });
  },

  // 点赞
  onToggleLike(e) {
    const postId = e.currentTarget.dataset.id;
    if (!postId) return;
    wx.cloud
      .callFunction({
        name: 'circle',
        data: { action: 'toggleLike', postId },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '操作失败', icon: 'none' });
          return;
        }
        const liked = !!result.liked;
        const posts = (this.data.posts || []).map((p) => {
          if (p._id !== postId) return p;
          const next = { ...p };
          next.hasLiked = liked;
          next.likeCount = (next.likeCount || 0) + (liked ? 1 : -1);
          if (next.likeCount < 0) next.likeCount = 0;
          return next;
        });
        this.setData({ posts });
      })
      .catch((err) => wx.showToast({ title: err.message || '操作失败', icon: 'none' }));
  },

  // 从云函数获取动态列表
  fetchPosts() {
    return wx.cloud
      .callFunction({
        name: 'circle',
        data: { action: 'listPosts', page: 1, pageSize: 20 },
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
            if (diff < oneHour) timeText = '刚刚';
            else if (diff < oneDay) timeText = `${Math.floor(diff / oneHour)}小时前`;
            else timeText = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          }
          return { ...item, timeText };
        });
        this.setData({ posts: list });
      })
      .catch((err) => wx.showToast({ title: err.message || '加载失败', icon: 'none' }));
  },

  // 活动列表
  fetchActivities() {
    return wx.cloud
      .callFunction({
        name: 'events',
        data: { action: 'listPublished', page: 1, pageSize: 20 },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '加载失败', icon: 'none' });
          return;
        }
        this.setData({ activities: result.list || [] });
      })
      .catch((err) => wx.showToast({ title: err.message || '加载失败', icon: 'none' }));
  },

  onTapEvent(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/events/detail/detail?eventId=${id}` });
  },

  // ===== 找校友筛选（默认显示：大学/年级/专业；逐级筛选）=====
  onPickSchool() {
    this.openPicker('school');
  },

  onPickGrade() {
    this.openPicker('grade');
  },

  onPickMajor() {
    this.openPicker('major');
  },

  openPicker(type) {
    let title = '请选择';
    let items = [];
    if (type === 'school') {
      title = '选择大学';
      items = this.data.schoolOptions || [];
    } else if (type === 'grade') {
      title = '选择年级';
      items = this.data.gradeOptions || [];
    } else if (type === 'major') {
      title = '选择专业';
      items = this.data.majorOptions || [];
    }
    this.setData({
      pickerVisible: true,
      pickerType: type,
      pickerTitle: title,
      pickerItems: items,
    });
  },

  closePicker() {
    this.setData({ pickerVisible: false, pickerType: '', pickerTitle: '', pickerItems: [] });
  },

  onPickItem(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (Number.isNaN(index)) return;
    const type = this.data.pickerType;
    if (type === 'school') {
      this.setData(
        {
          currentSchoolIndex: index,
          currentGradeIndex: 0,
          currentMajorIndex: 0,
        },
        () => {
          this.closePicker();
          this.fetchAlumni();
        }
      );
      return;
    }
    if (type === 'grade') {
      this.setData(
        {
          currentGradeIndex: index,
          currentMajorIndex: 0,
        },
        () => {
          this.closePicker();
          this.fetchAlumni();
        }
      );
      return;
    }
    if (type === 'major') {
      this.setData({ currentMajorIndex: index }, () => {
        this.closePicker();
        this.fetchAlumni();
      });
    }
  },

  fetchAlumni() {
    const { schoolOptions, majorOptions, gradeOptions, currentSchoolIndex, currentMajorIndex, currentGradeIndex } = this.data;
    const schoolName = currentSchoolIndex > 0 ? schoolOptions[currentSchoolIndex] : '';
    const major = currentMajorIndex > 0 ? majorOptions[currentMajorIndex] : '';
    const gradeLabel = currentGradeIndex > 0 ? gradeOptions[currentGradeIndex] : '';
    const enterYear = gradeLabel ? parseInt(gradeLabel.replace('级', ''), 10) : '';

    return wx.cloud
      .callFunction({
        name: 'searchAlumni',
        data: { schoolName, major, enterYear, page: 1, pageSize: 30 },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '查询失败', icon: 'none' });
          return;
        }
        this.setData({ alumniList: result.list || [] });
      })
      .catch((err) => wx.showToast({ title: err.message || '查询失败', icon: 'none' }));
  },
});
