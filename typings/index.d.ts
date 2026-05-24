/// <reference path="./types/index.d.ts" />

interface IAppOption {
  globalData: {
    userInfo?: WechatMiniprogram.UserInfo
    /** 登录后的用户昵称，用于首页展示 */
    userNickName?: string
    /** 待注册用户信息，从首页登录跳转注册页时传入 */
    pendingRegister?: {
      nickName: string
      avatarUrl: string
    }
    /** 从首页快捷入口进入校友服务时打开的 tab：benefit 校友福利 / return 返校服务 / donate 捐赠通道 */
    servicesInitialTab?: string
  }
  userInfoReadyCallback?: WechatMiniprogram.GetUserInfoSuccessCallback
}