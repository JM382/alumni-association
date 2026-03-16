// 帮助中心：常见问题 + 联系我们，具体交互后续补充
Page({
  data: {
    faqList: [
      {
        id: 1,
        question: '如何完成校友认证?',
        answer: '在"我的-个人信息"中完善资料后,联系校友会管理员审核。',
      },
      {
        id: 2,
        question: '忘记是用哪个微信登录的怎么办?',
        answer: '请使用常用微信重新登录,如需合并信息请联系管理员。',
      },
      {
        id: 3,
        question: '如何关闭部分消息通知?',
        answer: '在"我的-消息通知"中可单独关闭活动、系统公告等。',
      },
      {
        id: 4,
        question: '校友圈发错内容怎么办?',
        answer: '可在动态详情中删除自己的动态,严重情况可联系管理员处理。',
      },
    ],
  },

  onLoad() {},

  onFaqTap(e) {
    const index = e.currentTarget.dataset.index;
    const item = this.data.faqList[index];
    if (!item) return;
    wx.showModal({
      title: item.question,
      content: item.answer,
      showCancel: false,
      confirmText: '知道了',
      confirmColor: '#b01e2b',
    });
  },
});
