Page({
  data: {
    content: '',
    mediaList: [], // { type: 'image' | 'video', src, thumb? }
    submitting: false,
  },

  onContentInput(e) {
    this.setData({ content: e.detail.value });
  },

  onChooseMedia() {
    const { mediaList } = this.data;
    const hasVideo = mediaList.some((m) => m.type === 'video');
    if (hasVideo) {
      wx.showToast({ title: '已选择视频，只能保留一个', icon: 'none' });
      return;
    }
    const imageCount = mediaList.filter((m) => m.type === 'image').length;
    const remain = 9 - imageCount;
    if (remain <= 0) {
      wx.showToast({ title: '最多 9 张图片', icon: 'none' });
      return;
    }
    wx.showActionSheet({
      itemList: ['图片', '视频'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.chooseMedia({
            count: remain,
            mediaType: ['image'],
            sourceType: ['album', 'camera'],
            success: (r) => {
              const list = (r.tempFiles || []).map((f) => ({
                type: 'image',
                src: f.tempFilePath,
              }));
              this.setData({ mediaList: mediaList.concat(list) });
            },
          });
        } else if (res.tapIndex === 1) {
          wx.chooseMedia({
            count: 1,
            mediaType: ['video'],
            sourceType: ['album', 'camera'],
            success: (r) => {
              const file = (r.tempFiles && r.tempFiles[0]) || null;
              if (!file) return;
              this.setData({
                mediaList: [
                  {
                    type: 'video',
                    src: file.tempFilePath,
                    thumb: file.thumbTempFilePath || '',
                  },
                ],
              });
            },
          });
        }
      },
    });
  },

  onRemoveMedia(e) {
    const index = e.currentTarget.dataset.index;
    const list = this.data.mediaList.slice();
    list.splice(index, 1);
    this.setData({ mediaList: list });
  },

  onSubmit() {
    if (this.data.submitting) return;
    const content = (this.data.content || '').trim();
    const mediaList = this.data.mediaList || [];
    if (!content && mediaList.length === 0) {
      wx.showToast({ title: '请输入内容或选择媒体', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });

    const uploads = mediaList.map((m) => {
      const ext = m.type === 'image' ? 'jpg' : 'mp4';
      const cloudPath = `circle/${m.type}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;
      return wx.cloud.uploadFile({
        cloudPath,
        filePath: m.src,
      }).then((res) => ({
        type: m.type,
        fileID: res.fileID,
      }));
    });

    Promise.all(uploads)
      .then((results) => {
        const images = results.filter((r) => r.type === 'image').map((r) => r.fileID);
        const videoItem = results.find((r) => r.type === 'video');
        const video = videoItem ? videoItem.fileID : '';
        return wx.cloud.callFunction({
          name: 'circle',
          data: {
            action: 'createPost',
            content,
            images,
            video,
          },
        });
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '发布失败', icon: 'none' });
          return;
        }
        wx.showToast({ title: '发布成功', icon: 'success' });
        setTimeout(() => {
          wx.navigateBack();
        }, 500);
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '发布失败', icon: 'none' });
      })
      .finally(() => {
        this.setData({ submitting: false });
      });
  },

  get canSubmit() {
    return (this.data.content && this.data.content.trim()) || (this.data.mediaList || []).length > 0;
  },
});

