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
  pageLifetimes: {
    show() {
      const pages = getCurrentPages()
      const cur = pages[pages.length - 1]
      const route = cur ? cur.route : ''
      const idx = this.data.list.findIndex(item => item.pagePath === '/' + route)
      if (idx !== -1 && idx !== this.data.selected) {
        this.setData({ selected: idx })
      }
    }
  },
  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset
      const url = data.path
      const index = data.index
      this.setData({ selected: index })
      wx.switchTab({ url })
    }
  }
})
