Page({
  data: {
    applicationId: '',
    loading: false,
    detail: null,
    submitting: false,
  },

  onLoad(options) {
    const applicationId = (options && options.applicationId) || '';
    if (!applicationId) {
      wx.showToast({ title: '缺少申请参数', icon: 'none' });
      return;
    }
    this.setData({ applicationId });
    this.fetchDetail();
  },

  formatTime(v) {
    const d = v ? new Date(v) : null;
    if (!d || Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}`;
  },

  fetchDetail() {
    this.setData({ loading: true });
    wx.cloud
      .callFunction({
        name: 'authApplications',
        data: {
          action: 'adminDetail',
          applicationId: this.data.applicationId,
        },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '加载失败', icon: 'none' });
          return;
        }
        const d = result.data || null;
        if (d) {
          d.updatedAtText = this.formatTime(d.updatedAt || d.createdAt);
        }
        this.setData({ detail: d });
      })
      .catch((err) => wx.showToast({ title: err.message || '加载失败', icon: 'none' }))
      .finally(() => this.setData({ loading: false }));
  },

  onPreviewImage(e) {
    const urls = e.currentTarget.dataset.urls || [];
    const current = e.currentTarget.dataset.current || '';
    if (!urls.length) return;
    wx.previewImage({
      current: current || urls[0],
      urls,
    });
  },

  submitReview(action) {
    if (this.data.submitting) return;
    const applicationId = this.data.applicationId;
    if (!applicationId) return;

    const doSubmit = (payload) => {
      this.setData({ submitting: true });
      wx.cloud
        .callFunction({
          name: 'authApplications',
          data: {
            action: 'adminReview',
            applicationId,
            ...payload,
          },
        })
        .then((res) => {
          const result = res.result || {};
          if (!result.success) {
            wx.showToast({ title: result.error || '操作失败', icon: 'none' });
            return;
          }
          wx.showToast({ title: action === 'approve' ? '已通过' : '已打回', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 500);
        })
        .catch((err) => wx.showToast({ title: err.message || '操作失败', icon: 'none' }))
        .finally(() => this.setData({ submitting: false }));
    };

    if (action === 'approve') {
      wx.showModal({
        title: '确认通过',
        content: '确认通过该认证申请吗？',
        success: (r) => {
          if (!r.confirm) return;
          doSubmit({ reviewAction: 'approve' });
        },
      });
      return;
    }

    wx.showModal({
      title: '打回原因',
      editable: true,
      placeholderText: '请输入打回原因',
      success: (r) => {
        if (!r.confirm) return;
        doSubmit({
          reviewAction: 'reject',
          rejectReason: (r.content || '').trim() || '资料不符合要求',
        });
      },
    });
  },

  onApprove() {
    this.submitReview('approve');
  },

  onReject() {
    this.submitReview('reject');
  },
});
