Page({
  data: {
    loading: false,
    isAdmin: false,
    admin: null,
    menus: [],
  },

  onShow() {
    this.loadAdminProfile();
  },

  buildMenus(admin) {
    const scopes = (admin && admin.scopes) || [];
    const has = (s) => admin && (admin.level === 'super_admin' || scopes.includes(s));
    const list = [];
    if (has('alumni_audit')) list.push({ key: 'alumni', title: '校友认证审核', category: 'alumni' });
    if (has('company_audit')) list.push({ key: 'company', title: '企业认证审核', category: 'company' });
    if (has('expert_audit')) list.push({ key: 'expert', title: '专家认证审核', category: 'expert' });
    if (has('membership_ops')) list.push({ key: 'membership', title: '会员管理', category: '' });
    return list;
  },

  loadAdminProfile() {
    this.setData({ loading: true });
    wx.cloud
      .callFunction({
        name: 'authApplications',
        data: { action: 'myAdminProfile' },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success || !result.isAdmin) {
          this.setData({ isAdmin: false, admin: null, menus: [] });
          return;
        }
        const admin = result.admin || {};
        this.setData({
          isAdmin: true,
          admin,
          menus: this.buildMenus(admin),
        });
      })
      .catch(() => {
        this.setData({ isAdmin: false, admin: null, menus: [] });
      })
      .finally(() => this.setData({ loading: false }));
  },

  onTapMenu(e) {
    const category = e.currentTarget.dataset.category || '';
    if (category) {
      wx.navigateTo({
        url: `/pages/admin/review-list/review-list?category=${category}`,
      });
      return;
    }
    wx.showToast({ title: '该模块建设中', icon: 'none' });
  },

  onExitAdminMode() {
    wx.setStorageSync('entryMode', 'normal');
    wx.reLaunch({ url: '/pages/login/login' });
  },
});
