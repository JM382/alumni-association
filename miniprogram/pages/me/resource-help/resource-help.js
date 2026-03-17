// pages/me/resource-help/resource-help.js
Page({
  data: {
    list: [],
  },

  onLoad() {
    // 先用静态示例卡片，后续再接资源云函数
    this.setData({
      list: [
        {
          id: '1',
          title: '寻找北京互联网产品实习机会',
          desc: '19级计算机校友，正在找暑期产品实习，欢迎内推～',
          tag: '实习内推',
          city: '北京',
        },
        {
          id: '2',
          title: '求购一套考研资料',
          desc: '西工大电子信息考研资料，有转让的学长学姐吗？',
          tag: '学习资料',
          city: '西安',
        },
      ],
    });
  },

  onTapItem() {
    wx.showToast({ title: '资源详情稍后接入', icon: 'none' });
  },
});

