// pages/profile/profile.js
Page({
  data: {
    // 表单数据
    formData: {
      name: '',
      alumniNo: '',
      phone: '',
      email: '',
      enrollmentYear: '',
      college: '',
      major: '',
      class: '',
      introduction: '',
      company: '',
      position: '',
      industry: '',
      workLocation: '',
      hobbies: [],
      phoneVisible: true,
      emailVisible: true,
      workVisible: true
    },
    
    // 原始数据（用于比较是否修改）
    originalData: {},
    
    // 是否已修改
    isChanged: false,
    
    // 头像URL
    avatarUrl: '',
    
    // 选择器数据
    yearList: [],
    collegeList: [],
    industryList: [],
    
    // 选择器索引
    yearIndex: 0,
    collegeIndex: 0,
    industryIndex: 0,
    
    // 选择器显示状态
    showYearPicker: false,
    showCollegePicker: false,
    showIndustryPicker: false,
    
    // 兴趣爱好列表
    hobbyList: [
      { value: 'sports', label: '运动' },
      { value: 'music', label: '音乐' },
      { value: 'reading', label: '阅读' },
      { value: 'travel', label: '旅行' },
      { value: 'photography', label: '摄影' },
      { value: 'cooking', label: '烹饪' },
      { value: 'movie', label: '电影' },
      { value: 'technology', label: '科技' },
      { value: 'investment', label: '投资' },
      { value: 'volunteer', label: '志愿者' }
    ]
  },

  onLoad() {
    this.initData();
    this.loadUserProfile();
  },

  // 初始化数据
  initData() {
    // 生成年份列表（从1970到当前年份）
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = 1970; year <= currentYear; year++) {
      years.push(`${year}年`);
    }
    
    // 学院列表（根据哈军工实际情况）
    const colleges = [
      '计算机与信息工程学院',
      '电子信息工程学院',
      '航空航天学院',
      '材料科学与工程学院',
      '机械工程学院',
      '自动化学院',
      '理学院',
      '经管学院',
      '人文学院',
      '其他'
    ];
    
    // 行业列表
    const industries = [
      '信息技术',
      '金融',
      '教育',
      '医疗',
      '制造业',
      '房地产',
      '文化传媒',
      '能源',
      '交通物流',
      '政府机构',
      '其他'
    ];
    
    this.setData({
      yearList: years,
      collegeList: colleges,
      industryList: industries
    });
  },

  // 加载用户资料
  loadUserProfile() {
    // 模拟从服务器加载数据
    const mockData = {
      name: '黄今慧',
      alumniNo: 'No.2024010001',
      phone: '13800138000',
      email: 'example@bjtu.edu.cn',
      enrollmentYear: '2010年',
      college: '计算机与信息工程学院',
      major: '计算机科学与技术',
      class: '计科1001班',
      introduction: '哈军工校友，目前在北京工作，从事互联网行业。热爱技术，喜欢运动和旅行。',
      company: '北京科技有限公司',
      position: '高级工程师',
      industry: '信息技术',
      workLocation: '北京',
      hobbies: ['reading', 'sports', 'travel'],
      phoneVisible: true,
      emailVisible: true,
      workVisible: true
    };
    
    this.setData({
      'formData': mockData,
      'originalData': JSON.parse(JSON.stringify(mockData)),
      avatarUrl: '/images/default-avatar.png'
    });
    
    this.checkIfChanged();
  },

  // 检查数据是否修改
  checkIfChanged() {
    const formData = JSON.stringify(this.data.formData);
    const originalData = JSON.stringify(this.data.originalData);
    const isChanged = formData !== originalData;
    
    this.setData({ isChanged });
  },

  // 选择头像
  chooseAvatar() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        this.setData({ avatarUrl: tempFilePath });
        
        // TODO: 上传头像到服务器
        wx.showToast({
          title: '头像已选择',
          icon: 'success'
        });
        
        this.setData({ isChanged: true });
      }
    });
  },

  // 显示年份选择器
  showYearPicker() {
    this.setData({ showYearPicker: true });
  },

  // 显示学院选择器
  showCollegePicker() {
    this.setData({ showCollegePicker: true });
  },

  // 显示行业选择器
  showIndustryPicker() {
    this.setData({ showIndustryPicker: true });
  },

  // 隐藏所有选择器
  hidePickers() {
    this.setData({
      showYearPicker: false,
      showCollegePicker: false,
      showIndustryPicker: false
    });
  },

  // 年份选择
  onYearChange(e) {
    const index = e.detail.value;
    this.setData({
      'formData.enrollmentYear': this.data.yearList[index],
      yearIndex: index,
      showYearPicker: false
    });
    this.checkIfChanged();
  },

  // 学院选择
  onCollegeChange(e) {
    const index = e.detail.value;
    this.setData({
      'formData.college': this.data.collegeList[index],
      collegeIndex: index,
      showCollegePicker: false
    });
    this.checkIfChanged();
  },

  // 行业选择
  onIndustryChange(e) {
    const index = e.detail.value;
    this.setData({
      'formData.industry': this.data.industryList[index],
      industryIndex: index,
      showIndustryPicker: false
    });
    this.checkIfChanged();
  },

  // 切换兴趣爱好
  toggleHobby(e) {
    const value = e.currentTarget.dataset.value;
    const hobbies = [...this.data.formData.hobbies];
    const index = hobbies.indexOf(value);
    
    if (index === -1) {
      if (hobbies.length >= 5) {
        wx.showToast({
          title: '最多选择5个兴趣爱好',
          icon: 'none'
        });
        return;
      }
      hobbies.push(value);
    } else {
      hobbies.splice(index, 1);
    }
    
    this.setData({
      'formData.hobbies': hobbies
    });
    this.checkIfChanged();
  },

  // 表单输入事件处理
  onNameChange(e) {
    this.setData({
      'formData.name': e.detail.value
    });
    this.checkIfChanged();
  },

  onPhoneChange(e) {
    this.setData({
      'formData.phone': e.detail.value
    });
    this.checkIfChanged();
  },

  onEmailChange(e) {
    this.setData({
      'formData.email': e.detail.value
    });
    this.checkIfChanged();
  },

  onMajorChange(e) {
    this.setData({
      'formData.major': e.detail.value
    });
    this.checkIfChanged();
  },

  onClassChange(e) {
    this.setData({
      'formData.class': e.detail.value
    });
    this.checkIfChanged();
  },

  onIntroductionChange(e) {
    this.setData({
      'formData.introduction': e.detail.value
    });
    this.checkIfChanged();
  },

  onCompanyChange(e) {
    this.setData({
      'formData.company': e.detail.value
    });
    this.checkIfChanged();
  },

  onPositionChange(e) {
    this.setData({
      'formData.position': e.detail.value
    });
    this.checkIfChanged();
  },

  onWorkLocationChange(e) {
    this.setData({
      'formData.workLocation': e.detail.value
    });
    this.checkIfChanged();
  },

  // 隐私设置开关
  onPhoneVisibleChange(e) {
    this.setData({
      'formData.phoneVisible': e.detail.value
    });
    this.checkIfChanged();
  },

  onEmailVisibleChange(e) {
    this.setData({
      'formData.emailVisible': e.detail.value
    });
    this.checkIfChanged();
  },

  onWorkVisibleChange(e) {
    this.setData({
      'formData.workVisible': e.detail.value
    });
    this.checkIfChanged();
  },

  // 保存资料
  saveProfile() {
    if (!this.data.isChanged) {
      return;
    }

    // 表单验证
    if (!this.validateForm()) {
      return;
    }

    wx.showLoading({
      title: '保存中...',
      mask: true
    });

    // 模拟API请求
    setTimeout(() => {
      wx.hideLoading();
      
      // 更新原始数据
      this.setData({
        originalData: JSON.parse(JSON.stringify(this.data.formData)),
        isChanged: false
      });

      wx.showToast({
        title: '保存成功',
        icon: 'success',
        duration: 2000
      });

      // 延迟返回上一页
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }, 1500);
  },

  // 表单验证
  validateForm() {
    const data = this.data.formData;

    // 姓名验证
    if (!data.name || data.name.trim().length === 0) {
      wx.showToast({
        title: '请输入姓名',
        icon: 'none'
      });
      return false;
    }

    // 手机号验证
    if (data.phone) {
      const phoneReg = /^1[3-9]\d{9}$/;
      if (!phoneReg.test(data.phone)) {
        wx.showToast({
          title: '手机号格式不正确',
          icon: 'none'
        });
        return false;
      }
    }

    // 邮箱验证
    if (data.email) {
      const emailReg = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailReg.test(data.email)) {
        wx.showToast({
          title: '邮箱格式不正确',
          icon: 'none'
        });
        return false;
      }
    }

    return true;
  },

  onUnload() {
    // 页面卸载时检查是否有未保存的修改
    if (this.data.isChanged) {
      wx.showModal({
        title: '提示',
        content: '您有未保存的修改，确定要离开吗？',
        success: (res) => {
          if (res.confirm) {
            // 用户确认离开
          }
        }
      });
    }
  }
});