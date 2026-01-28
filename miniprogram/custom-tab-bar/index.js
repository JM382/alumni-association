Component({
  data: {
    selected: 0,
    color: "#999999",
    selectedColor: "#b01e2b",
    list: [
      {
        pagePath: "/pages/index/index",
        text: "首页",
        iconPath: "/images/tabbar/btn_index.png",
        selectedIconPath: "/images/tabbar/btn_select_index.png"
      },
      {
        pagePath: "/pages/welfare/welfare",
        text: "校友福利",
        iconPath: "/images/tabbar/btn_welfare.png",
        selectedIconPath: "/images/tabbar/btn_select_welfare.png"
      },
      {
        pagePath: "/pages/news/news",
        text: "资讯",
        iconPath: "/images/tabbar/btn_news.png",
        selectedIconPath: "/images/tabbar/btn_select_news.png"
      },
      {
        pagePath: "/pages/circle/circle",
        text: "校友圈",
        iconPath: "/images/tabbar/btn_circle.png",
        selectedIconPath: "/images/tabbar/btn_select_circle.png"
      },
      {
        pagePath: "/pages/me/me",
        text: "我的",
        iconPath: "/images/tabbar/btn_me.png",
        selectedIconPath: "/images/tabbar/btn_select_me.png"
      }
    ]
  },
  attached() {},
  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset
      const url = data.path
      wx.switchTab({ url })
      this.setData({
        selected: data.index
      })
    }
  }
})
