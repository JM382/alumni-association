// pages/me/resource-create/resource-create.js
Page({
  data: {
    category: 'help', // help | publish
    title: '',
    content: '',
    tag: '',
    contact: '',
    mediaList: [], // { type: 'image'|'video', tempFilePath, fileID? }
    canSubmit: false,
    submitting: false,
  },

  explainAndHandlePublishError(message) {
    const msg = message || '发布失败';
    if (msg.includes('仅校友可发布')) {
      wx.showModal({
        title: '需要校友身份',
        content: '发布资源/求助仅对已认证校友开放，请先完成校友认证。',
        confirmText: '去认证',
        cancelText: '知道了',
        success: (r) => {
          if (r.confirm) {
            wx.navigateTo({ url: '/pages/me/auth/auth' });
          }
        },
      });
      return;
    }
    if (msg.includes('FUNCTION_NOT_FOUND') || msg.includes('resources')) {
      wx.showModal({
        title: '后端未部署',
        content: 'resources 云函数未部署或名称不一致。请在云函数列表部署 resources 后重试。',
        showCancel: false,
      });
      return;
    }
    if (msg.includes('Db or Table not exist') || msg.includes('collection') || msg.includes('resource_posts')) {
      wx.showModal({
        title: '集合未创建',
        content: '请在云开发数据库创建集合：resource_posts / resource_comments / resource_likes，然后重试。',
        showCancel: false,
      });
      return;
    }
    wx.showToast({ title: msg, icon: 'none' });
  },

  onLoad(options) {
    const category = (options && options.category) || 'help';
    const c = category === 'publish' ? 'publish' : 'help';
    this.setData({ category: c }, () => {
      wx.setNavigationBarTitle({ title: c === 'help' ? '发布求助' : '发布资源' });
      this.recomputeCanSubmit();
    });
  },

  onTitleInput(e) {
    this.setData({ title: e.detail.value });
    this.recomputeCanSubmit();
  },

  onContentInput(e) {
    this.setData({ content: e.detail.value });
    this.recomputeCanSubmit();
  },

  onTagInput(e) {
    this.setData({ tag: e.detail.value });
  },

  onContactInput(e) {
    this.setData({ contact: e.detail.value });
    this.recomputeCanSubmit();
  },

  recomputeCanSubmit() {
    const { title, content, contact, mediaList } = this.data;
    const ok = !!title.trim() && (!!content.trim() || (mediaList && mediaList.length > 0)) && !!contact.trim();
    this.setData({ canSubmit: ok });
  },

  onChooseMedia() {
    const { mediaList, submitting } = this.data;
    if (submitting) return;
    const hasVideo = mediaList.some((m) => m.type === 'video');
    const hasImages = mediaList.some((m) => m.type === 'image');
    wx.chooseMedia({
      count: hasVideo ? 0 : hasImages ? Math.max(0, 9 - mediaList.length) : 9,
      mediaType: ['image', 'video'],
      sourceType: ['album', 'camera'],
      maxDuration: 60,
      success: (res) => {
        const files = res.tempFiles || [];
        if (!files.length) return;
        const next = [];
        for (const f of files) {
          const type = f.fileType === 'video' ? 'video' : 'image';
          next.push({ type, tempFilePath: f.tempFilePath });
        }
        const pickedHasVideo = next.some((m) => m.type === 'video');
        let merged = mediaList.slice();
        if (pickedHasVideo) merged = [];
        merged = merged.filter((m) => (pickedHasVideo ? false : m.type !== 'video'));
        merged = merged.concat(next);

        const videos = merged.filter((m) => m.type === 'video');
        const images = merged.filter((m) => m.type === 'image').slice(0, 9);
        merged = videos.length ? [videos[0]] : images;

        this.setData({ mediaList: merged }, () => this.recomputeCanSubmit());
      },
    });
  },

  onRemoveMedia(e) {
    const idx = Number(e.currentTarget.dataset.index);
    if (Number.isNaN(idx)) return;
    const next = this.data.mediaList.slice();
    next.splice(idx, 1);
    this.setData({ mediaList: next }, () => this.recomputeCanSubmit());
  },

  uploadAll() {
    const { mediaList } = this.data;
    if (!mediaList.length) return Promise.resolve({ images: [], video: null });
    const tasks = mediaList.map((m) => {
      const ext = (m.tempFilePath.split('.').pop() || '').toLowerCase();
      const cloudPath = `resources/${Date.now()}_${Math.random().toString(16).slice(2)}.${ext || (m.type === 'video' ? 'mp4' : 'jpg')}`;
      return wx.cloud
        .uploadFile({ cloudPath, filePath: m.tempFilePath })
        .then((r) => ({ ...m, fileID: r.fileID }));
    });
    return Promise.all(tasks).then((uploaded) => {
      const video = uploaded.find((m) => m.type === 'video');
      const images = uploaded.filter((m) => m.type === 'image').map((m) => m.fileID);
      return { images, video: video ? { fileID: video.fileID } : null };
    });
  },

  onSubmit() {
    const { category, title, content, tag, contact, canSubmit, submitting } = this.data;
    if (submitting) return;
    if (!canSubmit) {
      wx.showToast({ title: '请完善标题/内容/联系方式', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    wx.showLoading({ title: '发布中...' });
    this.uploadAll()
      .then(({ images, video }) =>
        wx.cloud.callFunction({
          name: 'resources',
          data: {
            action: 'createPost',
            category,
            title,
            content,
            tag,
            contact,
            images,
            video,
          },
        })
      )
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          this.explainAndHandlePublishError(result.error || '发布失败');
          return;
        }
        wx.showToast({ title: '发布成功', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 300);
      })
      .catch((err) => this.explainAndHandlePublishError((err && (err.message || err.errMsg)) || '发布失败'))
      .finally(() => {
        wx.hideLoading();
        this.setData({ submitting: false });
      });
  },
});

