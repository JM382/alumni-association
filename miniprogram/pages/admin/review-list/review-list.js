Page({
  data: {
    category: 'alumni',
    tabs: [
      { key: 'alumni', label: '校友审核' },
      { key: 'company', label: '企业审核' },
      { key: 'expert', label: '专家审核' },
    ],
    statusTabs: [
      { key: 'pending', label: '待审核' },
      { key: 'approved', label: '已通过' },
      { key: 'rejected', label: '已打回' },
    ],
    status: 'pending',
    list: [],
    loading: false,
  },

  onLoad(options) {
    const category = (options && options.category) || 'alumni';
    this.setData({
      category: ['alumni', 'company', 'expert'].includes(category) ? category : 'alumni',
    });
  },

  onShow() {
    this.fetchList();
  },

  onSwitchCategory(e) {
    const category = e.currentTarget.dataset.category;
    if (!category || category === this.data.category) return;
    this.setData({ category }, () => this.fetchList());
  },

  onSwitchStatus(e) {
    const status = e.currentTarget.dataset.status;
    if (!status || status === this.data.status) return;
    this.setData({ status }, () => this.fetchList());
  },

  getDisplayName(item) {
    if (item.category === 'alumni') return (item.alumniInfo && item.alumniInfo.realName) || '未命名申请';
    if (item.category === 'company') return (item.companyInfo && item.companyInfo.companyName) || '未命名申请';
    if (item.category === 'expert') return (item.expertInfo && item.expertInfo.realName) || '未命名申请';
    return '未命名申请';
  },

  getDisplaySub(item) {
    if (item.category === 'alumni') {
      const info = item.alumniInfo || {};
      return `${info.school || ''} ${info.major || ''}`.trim();
    }
    if (item.category === 'company') {
      const info = item.companyInfo || {};
      return `${info.industry || ''} ${info.city || ''}`.trim();
    }
    if (item.category === 'expert') {
      const info = item.expertInfo || {};
      return `${info.organization || ''} ${info.title || ''}`.trim();
    }
    return '';
  },

  formatTime(v) {
    const d = v ? new Date(v) : null;
    if (!d || Number.isNaN(d.getTime())) return '--';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}`;
  },

  fetchList() {
    const { category, status } = this.data;
    this.setData({ loading: true });
    wx.cloud
      .callFunction({
        name: 'authApplications',
        data: {
          action: 'adminList',
          category,
          status,
          page: 1,
          pageSize: 100,
        },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '加载失败', icon: 'none' });
          return;
        }
        const list = (result.list || []).map((item) => ({
          ...item,
          displayName: this.getDisplayName(item),
          displaySub: this.getDisplaySub(item),
          updatedAtText: this.formatTime(item.updatedAt || item.createdAt),
        }));
        this.setData({ list });
      })
      .catch((err) => wx.showToast({ title: err.message || '加载失败', icon: 'none' }))
      .finally(() => this.setData({ loading: false }));
  },

  onTapItem(e) {
    const applicationId = e.currentTarget.dataset.id;
    if (!applicationId) return;
    wx.navigateTo({
      url: `/pages/admin/review-detail/review-detail?applicationId=${applicationId}`,
    });
  },
});
