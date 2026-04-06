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

    // 保存按钮状态（像个人信息页一样）
    originalForms: null, // { alumni: {...}, company: {...}, expert: {...} }
    hasChanged: false,
  },

  onLoad(options) {
    const adminCategory = options && options.adminCategory;
    if (adminCategory && ['alumni', 'company', 'expert'].includes(adminCategory)) {
      this.setData({ activeCategory: adminCategory });
    }
    wx.setNavigationBarTitle({ title: this.data.title });
    // 先加载本地草稿，保证“填写过不丢”
    this.loadDrafts();
    this.ensureUserReady().then(() => {
      this.fetchStatus();
      this.fetchLatestForms();
    });
  },

  onShow() {
    // 回到页面时刷新状态
    this.ensureUserReady().then(() => {
      this.fetchStatus();
      // 确保历史记录回填可见（例如用户在别处提交后返回）
      this.fetchLatestForms();
    });
  },

  // 认证页兜底：若 users 中没有当前用户，先触发一次 login 建档
  ensureUserReady() {
    return wx.cloud
      .callFunction({ name: 'getUserInfo' })
      .then((res) => {
        const result = res.result || {};
        const data = result.code === 0 ? result.data : null;
        if (data && (data.user_id || data._id)) return;
        return wx.cloud.callFunction({
          name: 'login',
          data: { nickname: '', avatarUrl: '' },
        });
      })
      .catch(() =>
        wx.cloud.callFunction({
          name: 'login',
          data: { nickname: '', avatarUrl: '' },
        })
      )
      .catch(() => {});
  },

  // ===== 草稿（本地兜底）=====
  draftKey(category) {
    return `auth_draft_${category}`;
  },

  loadDrafts() {
    try {
      const alumni = wx.getStorageSync(this.draftKey('alumni')) || null;
      const company = wx.getStorageSync(this.draftKey('company')) || null;
      const expert = wx.getStorageSync(this.draftKey('expert')) || null;
      if (alumni) this.setData({ formAlumni: { ...this.data.formAlumni, ...alumni } });
      if (company) this.setData({ formCompany: { ...this.data.formCompany, ...company } });
      if (expert) this.setData({ formExpert: { ...this.data.formExpert, ...expert } });
    } catch (e) {}
  },

  saveDraft(category) {
    try {
      const key = this.draftKey(category);
      if (category === 'alumni') wx.setStorageSync(key, this.data.formAlumni);
      if (category === 'company') wx.setStorageSync(key, this.data.formCompany);
      if (category === 'expert') wx.setStorageSync(key, this.data.formExpert);
    } catch (e) {}
  },

  // ===== 保存按钮灰/红（变更检测）=====
  computeHasChanged(current, original) {
    if (!original) {
      // 首次填写（尚无 original）时：只要有任一有效输入，就允许保存
      const keys = Object.keys(current || {});
      for (let i = 0; i < keys.length; i += 1) {
        const k = keys[i];
        const v = current[k];
        if (Array.isArray(v)) {
          if (v.length > 0) return true;
          continue;
        }
        if (typeof v === 'string') {
          if (v.trim()) return true;
          continue;
        }
        if (v !== null && v !== undefined && v !== '') {
          return true;
        }
      }
      return false;
    }
    const keys = Object.keys(original);
    for (let i = 0; i < keys.length; i += 1) {
      const k = keys[i];
      const a = current[k];
      const b = original[k];
      // 数组（图片）比较
      if (Array.isArray(a) || Array.isArray(b)) {
        const aa = Array.isArray(a) ? a : [];
        const bb = Array.isArray(b) ? b : [];
        if (aa.length !== bb.length) return true;
        for (let j = 0; j < aa.length; j += 1) {
          if ((aa[j] || '') !== (bb[j] || '')) return true;
        }
      } else if ((a || '') !== (b || '')) {
        return true;
      }
    }
    return false;
  },

  updateChangedState() {
    const c = this.data.activeCategory;
    const originals = this.data.originalForms || {};
    let current = {};
    let original = null;
    if (c === 'alumni') {
      current = this.data.formAlumni;
      original = originals.alumni || null;
    } else if (c === 'company') {
      current = this.data.formCompany;
      original = originals.company || null;
    } else {
      current = this.data.formExpert;
      original = originals.expert || null;
    }
    const hasChanged = this.computeHasChanged(current, original);
    if (hasChanged !== this.data.hasChanged) this.setData({ hasChanged });
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
          const pickKeys = (src, keys) => {
            const out = {};
            keys.forEach((k) => {
              if (src && src[k] !== undefined) out[k] = src[k];
            });
            return out;
          };
          if (category === 'alumni') {
            // 兼容：优先 alumniInfo；若历史数据结构不同，则从根字段回填
            const formKeys = Object.keys(this.data.formAlumni || {});
            const raw = latest.alumniInfo && typeof latest.alumniInfo === 'object' ? latest.alumniInfo : {};
            const fallback = latest && typeof latest === 'object' ? pickKeys(latest, formKeys) : {};
            const info = { ...fallback, ...raw };

            const schools = this.data.schoolOptions;
            const colleges = this.data.alumniCollegeOptions;
            const majors = this.data.alumniMajorOptions;
            const degrees = this.data.degreeOptions;

            const si = info.school ? schools.indexOf(info.school) : 0;
            const ci = info.college ? colleges.indexOf(info.college) : 0;
            const mi = info.major ? majors.indexOf(info.major) : 0;
            const di = info.degree ? degrees.indexOf(info.degree) : 0;

            const schoolIndex = si >= 0 ? si : (schools.length - 1);
            const alumniCollegeIndex = ci >= 0 ? ci : 0;
            const alumniMajorIndex = mi >= 0 ? mi : 0;
            const degreeIndex = di >= 0 ? di : 0;

            const mergedForm = { ...this.data.formAlumni, ...info };
            this.setData(
              {
                formAlumni: mergedForm,
                schoolIndex,
                alumniCollegeIndex,
                alumniMajorIndex,
                degreeIndex,
              },
              () => {
                const originals = this.data.originalForms || {};
                originals.alumni = { ...mergedForm };
                this.setData({ originalForms: originals }, () => this.updateChangedState());
              }
            );
          }
          if (category === 'company') {
            const formKeys = Object.keys(this.data.formCompany || {});
            const raw = latest.companyInfo && typeof latest.companyInfo === 'object' ? latest.companyInfo : {};
            const fallback = latest && typeof latest === 'object' ? pickKeys(latest, formKeys) : {};
            const info = { ...fallback, ...raw };
            const mergedForm = { ...this.data.formCompany, ...info };
            this.setData({ formCompany: mergedForm }, () => {
              const originals = this.data.originalForms || {};
              originals.company = { ...mergedForm };
              this.setData({ originalForms: originals }, () => this.updateChangedState());
            });
          }
          if (category === 'expert') {
            const formKeys = Object.keys(this.data.formExpert || {});
            const raw = latest.expertInfo && typeof latest.expertInfo === 'object' ? latest.expertInfo : {};
            const fallback = latest && typeof latest === 'object' ? pickKeys(latest, formKeys) : {};
            const info = { ...fallback, ...raw };
            const mergedForm = {
              ...this.data.formExpert,
              ...info,
              fieldTags: Array.isArray(info.fieldTags) ? info.fieldTags.join('、') : info.fieldTags || '',
            };
            this.setData({ formExpert: mergedForm }, () => {
              const originals = this.data.originalForms || {};
              originals.expert = { ...mergedForm };
              this.setData({ originalForms: originals }, () => this.updateChangedState());
            });
          }
        })
        .catch(() => {});
    });
  },

  onSwitchTab(e) {
    const type = e.currentTarget.dataset.type;
    if (!type) return;
    this.setData({ activeCategory: type }, () => this.updateChangedState());
  },

  onFieldInput(e) {
    const category = e.currentTarget.dataset.category;
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    if (!category || !field) return;
    const key = category === 'alumni' ? 'formAlumni' : category === 'company' ? 'formCompany' : 'formExpert';
    const form = { ...this.data[key], [field]: value };
    this.setData({ [key]: form });
    this.saveDraft(category);
    this.updateChangedState();
  },

  onSchoolChange(e) {
    const i = parseInt(e.detail.value, 10);
    const name = this.data.schoolOptions[i] || '';
    this.setData({
      schoolIndex: i,
      'formAlumni.school': name,
    });
    this.saveDraft('alumni');
    this.updateChangedState();
  },

  onAlumniCollegeChange(e) {
    const i = parseInt(e.detail.value, 10);
    const name = this.data.alumniCollegeOptions[i] || '';
    this.setData({
      alumniCollegeIndex: i,
      'formAlumni.college': name,
    });
    this.saveDraft('alumni');
    this.updateChangedState();
  },

  onAlumniMajorChange(e) {
    const i = parseInt(e.detail.value, 10);
    const name = this.data.alumniMajorOptions[i] || '';
    this.setData({
      alumniMajorIndex: i,
      'formAlumni.major': name,
    });
    this.saveDraft('alumni');
    this.updateChangedState();
  },

  onDegreeChange(e) {
    const i = parseInt(e.detail.value, 10);
    const name = this.data.degreeOptions[i] || '';
    this.setData({
      degreeIndex: i,
      'formAlumni.degree': name,
    });
    this.saveDraft('alumni');
    this.updateChangedState();
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
            this.saveDraft(category);
            this.updateChangedState();
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
    this.saveDraft(category);
    this.updateChangedState();
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
    if (!this.data.hasChanged) return;
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
        // 提交成功后，把当前表单作为 original，并置灰按钮
        const originals = this.data.originalForms || {};
        if (category === 'alumni') originals.alumni = { ...this.data.formAlumni };
        if (category === 'company') originals.company = { ...this.data.formCompany };
        if (category === 'expert') originals.expert = { ...this.data.formExpert };
        this.setData({ originalForms: originals, hasChanged: false });
        this.saveDraft(category);
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '提交失败', icon: 'none' });
      })
      .finally(() => {
        this.setData({ saving: false });
      });
  },
});
