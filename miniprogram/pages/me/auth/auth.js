// 认证与申请页：顶部三类切换 + 对应表单（校友 / 企业 / 专家）

Page({
  data: {
    title: '认证与申请',
    loading: false,
    saving: false,
    activeCategory: 'alumni',
    status: {
      alumni: { status: 'none' },
      company: { status: 'none' },
      expert: { status: 'none' },
    },
    statusTextAlumni: '未认证',
    statusTextCompany: '未认证',
    statusTextExpert: '未认证',
    schoolOptions: [
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
      '其他',
    ],
    alumniCollegeOptions: ['计算机学院', '机械学院', '电子信息学院', '经管学院', '其他'],
    alumniMajorOptions: ['计算机科学与技术', '软件工程', '通信工程', '自动化', '其他'],
    degreeOptions: ['本科', '硕士', '博士', '专科', '其他'],
    schoolIndex: 0,
    alumniCollegeIndex: 0,
    alumniMajorIndex: 0,
    degreeIndex: 0,
    formAlumni: {
      realName: '',
      studentId: '',
      school: '',
      college: '',
      major: '',
      degree: '',
      enterYear: '',
      gradYear: '',
      campus: '',
      contactMobile: '',
      contactEmail: '',
      certImages: [],
      extra: '',
    },
    formCompany: {
      companyName: '',
      uscc: '',
      licenseImage: '',
      industry: '',
      scale: '',
      city: '',
      address: '',
      contactName: '',
      contactMobile: '',
      contactEmail: '',
      position: '',
      website: '',
      extra: '',
    },
    formExpert: {
      realName: '',
      organization: '',
      title: '',
      fieldTags: '',
      city: '',
      resume: '',
      experienceYears: '',
      contactMobile: '',
      contactEmail: '',
      certImages: [],
      extra: '',
    },
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: this.data.title });
    this.fetchStatus();
    this.fetchLatestForms();
  },

  onShow() {
    // 回到页面时刷新状态
    this.fetchStatus();
  },

  mapStatusText(status) {
    if (!status || status === 'none') return '未认证';
    if (status === 'pending') return '审核中';
    if (status === 'approved') return '已通过';
    if (status === 'rejected') return '已拒绝';
    if (status === 'canceled') return '已取消';
    return '未知';
  },

  fetchStatus() {
    this.setData({ loading: true });
    wx.cloud
      .callFunction({
        name: 'authApplications',
        data: {
          action: 'myStatus',
        },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          // 若用户尚未登录（users 中不存在），不弹错误，只当作未认证处理
          if (result.error === '用户不存在') {
            this.setData({
              status: this.data.status,
            });
            return;
          }
          wx.showToast({ title: result.error || '加载失败', icon: 'none' });
          return;
        }
        const status = result.data || this.data.status;
        this.setData({
          status,
          statusTextAlumni: this.mapStatusText(status.alumni && status.alumni.status),
          statusTextCompany: this.mapStatusText(status.company && status.company.status),
          statusTextExpert: this.mapStatusText(status.expert && status.expert.status),
        });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  fetchLatestForms() {
    // 分别拉取三类最近一次申请，预填表单
    ['alumni', 'company', 'expert'].forEach((category) => {
      wx.cloud
        .callFunction({
          name: 'authApplications',
          data: {
            action: 'myHistory',
            category,
          },
        })
        .then((res) => {
          const result = res.result || {};
          if (!result.success) return;
          const list = result.list || [];
          if (!list.length) return;
          const latest = list[0];
          if (category === 'alumni' && latest.alumniInfo) {
            const info = latest.alumniInfo;
            const schools = this.data.schoolOptions;
            const schoolIndex = Math.max(
              0,
              info.school ? schools.indexOf(info.school) : 0,
            );
            this.setData({
              formAlumni: {
                ...this.data.formAlumni,
                ...info,
              },
              schoolIndex: schoolIndex === -1 ? schools.length - 1 : schoolIndex,
            });
          }
          if (category === 'company' && latest.companyInfo) {
            this.setData({
              formCompany: {
                ...this.data.formCompany,
                ...latest.companyInfo,
              },
            });
          }
          if (category === 'expert' && latest.expertInfo) {
            const info = latest.expertInfo;
            this.setData({
              formExpert: {
                ...this.data.formExpert,
                ...info,
                fieldTags: Array.isArray(info.fieldTags)
                  ? info.fieldTags.join('、')
                  : info.fieldTags || '',
              },
            });
          }
        })
        .catch(() => {});
    });
  },

  onSwitchTab(e) {
    const type = e.currentTarget.dataset.type;
    if (!type) return;
    this.setData({ activeCategory: type });
  },

  onFieldInput(e) {
    const category = e.currentTarget.dataset.category;
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    if (!category || !field) return;
    const key = category === 'alumni' ? 'formAlumni' : category === 'company' ? 'formCompany' : 'formExpert';
    const form = { ...this.data[key], [field]: value };
    this.setData({ [key]: form });
  },

  onSchoolChange(e) {
    const i = parseInt(e.detail.value, 10);
    const name = this.data.schoolOptions[i] || '';
    this.setData({
      schoolIndex: i,
      'formAlumni.school': name,
    });
  },

  onAlumniCollegeChange(e) {
    const i = parseInt(e.detail.value, 10);
    const name = this.data.alumniCollegeOptions[i] || '';
    this.setData({
      alumniCollegeIndex: i,
      'formAlumni.college': name,
    });
  },

  onAlumniMajorChange(e) {
    const i = parseInt(e.detail.value, 10);
    const name = this.data.alumniMajorOptions[i] || '';
    this.setData({
      alumniMajorIndex: i,
      'formAlumni.major': name,
    });
  },

  onDegreeChange(e) {
    const i = parseInt(e.detail.value, 10);
    const name = this.data.degreeOptions[i] || '';
    this.setData({
      degreeIndex: i,
      'formAlumni.degree': name,
    });
  },

  onChooseImage(e) {
    const category = e.currentTarget.dataset.category;
    const type = e.currentTarget.dataset.type || 'multi'; // multi 或 single
    const key = category === 'alumni' ? 'formAlumni' : category === 'company' ? 'formCompany' : 'formExpert';
    const form = { ...this.data[key] };

    let currentCount = 0;
    if (category === 'alumni' || category === 'expert') {
      currentCount = (form.certImages || []).length;
    }
    const maxCount = type === 'single' ? 1 : 6;
    const remain = maxCount - currentCount;
    if (remain <= 0) {
      wx.showToast({ title: '已达上传上限', icon: 'none' });
      return;
    }

    wx.chooseImage({
      count: remain,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const paths = res.tempFilePaths || [];
        if (!paths.length) return;
        wx.showLoading({ title: '上传中' });
        const uploads = paths.map((filePath) => {
          const cloudPath = `auth/${category}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
          return wx.cloud.uploadFile({ cloudPath, filePath });
        });
        Promise.all(uploads)
          .then((results) => {
            const ids = results.map((r) => r.fileID).filter(Boolean);
            if (category === 'company' && type === 'single') {
              form.licenseImage = ids[0] || '';
            } else if (category === 'alumni' || category === 'expert') {
              form.certImages = (form.certImages || []).concat(ids);
            }
            this.setData({ [key]: form });
          })
          .catch(() => {
            wx.showToast({ title: '上传失败', icon: 'none' });
          })
          .finally(() => {
            wx.hideLoading();
          });
      },
    });
  },

  onRemoveImage(e) {
    const category = e.currentTarget.dataset.category;
    const index = e.currentTarget.dataset.index;
    const key = category === 'alumni' ? 'formAlumni' : 'formExpert';
    const form = { ...this.data[key] };
    const arr = (form.certImages || []).slice();
    arr.splice(index, 1);
    form.certImages = arr;
    this.setData({ [key]: form });
  },

  validateCurrent() {
    const c = this.data.activeCategory;
    if (c === 'alumni') {
      const f = this.data.formAlumni;
      if (!f.realName) return this.toast('请填写姓名');
      if (!f.studentId) return this.toast('请填写学号');
      if (!f.school) return this.toast('请选择学校');
      if (!f.college) return this.toast('请填写学院');
      if (!f.major) return this.toast('请填写专业');
      if (!f.enterYear) return this.toast('请填写入学年份');
      if (!f.contactMobile) return this.toast('请填写联系电话');
      if (!/^1\d{10}$/.test((f.contactMobile || '').trim())) return this.toast('手机号格式不正确');
      if (!f.contactEmail) return this.toast('请填写邮箱');
      return true;
    }
    if (c === 'company') {
      const f = this.data.formCompany;
      if (!f.companyName) return this.toast('请填写公司名称');
      if (!f.uscc) return this.toast('请填写统一社会信用代码');
      if (!f.licenseImage) return this.toast('请上传营业执照');
      if (!f.contactName) return this.toast('请填写联系人姓名');
      if (!f.contactMobile) return this.toast('请填写联系电话');
      if (!/^1\d{10}$/.test((f.contactMobile || '').trim())) return this.toast('手机号格式不正确');
      return true;
    }
    if (c === 'expert') {
      const f = this.data.formExpert;
      if (!f.realName) return this.toast('请填写姓名');
      if (!f.organization) return this.toast('请填写所在单位');
      if (!f.title) return this.toast('请填写职称/职务');
      if (!f.contactMobile) return this.toast('请填写联系电话');
      if (!/^1\d{10}$/.test((f.contactMobile || '').trim())) return this.toast('手机号格式不正确');
      if (!f.contactEmail) return this.toast('请填写邮箱');
      return true;
    }
    return false;
  },

  toast(msg) {
    wx.showToast({ title: msg, icon: 'none' });
    return false;
  },

  onSubmit() {
    if (this.data.saving) return;
    if (!this.validateCurrent()) return;
    const category = this.data.activeCategory;
    let payload = {};
    if (category === 'alumni') {
      payload = { ...this.data.formAlumni };
    } else if (category === 'company') {
      payload = { ...this.data.formCompany };
    } else if (category === 'expert') {
      const f = { ...this.data.formExpert };
      if (typeof f.fieldTags === 'string') {
        f.fieldTags = f.fieldTags
          .split(/[,，、\s]+/)
          .filter(Boolean);
      }
      payload = f;
    }

    this.setData({ saving: true });
    wx.cloud
      .callFunction({
        name: 'authApplications',
        data: {
          action: 'submit',
          category,
          payload,
        },
      })
      .then((res) => {
        const result = res.result || {};
        if (!result.success) {
          wx.showToast({ title: result.error || '提交失败', icon: 'none' });
          return;
        }
        wx.showToast({ title: '已提交审核', icon: 'success' });
        this.fetchStatus();
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '提交失败', icon: 'none' });
      })
      .finally(() => {
        this.setData({ saving: false });
      });
  },
});
