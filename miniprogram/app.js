// app.js - 哈军工北京校友会 · 校友服务平台
// 主体色 #b01e2b 已在各页面与 tabBar 中使用
App({
  onLaunch: function () {
    this.globalData = {
      // 云开发环境 ID：在微信开发者工具「云开发」控制台创建环境后，将环境 ID 填在此处；
      // 留空 "" 则使用该账号下的默认环境（第一个创建的环境）
      env: "cloud1-7g1x07md7360212c",
      mainColor: "#b01e2b",
    };
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        env: this.globalData.env || undefined,
        traceUser: true,
      });
    }
  },
});
