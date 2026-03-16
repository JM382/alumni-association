Page({
  data: { title: '我的活动' },
  onLoad() { wx.setNavigationBarTitle({ title: this.data.title }); },
});
