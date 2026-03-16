// cloudfunctions/getUserInfo/index.js
// 按 openid 查用户，返回数据中统一带上 user_id（供订单、通讯录等集合归属使用）
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const userCollection = db.collection('users');

function resolveUserId(doc) {
  return (doc && (doc.user_id || doc._id)) || '';
}

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;

    const res = await userCollection.where({ openid }).limit(1).get();

    if (res.data.length === 0) {
      return { code: 0, data: {}, msg: '获取成功' };
    }

    const raw = res.data[0];
    const user_id = resolveUserId(raw);
    // 返回时带上 user_id，前端及其他云函数写 orders/contacts 等时可使用
    const data = { ...raw, user_id };
    return {
      code: 0,
      data,
      msg: '获取成功',
    };
  } catch (err) {
    console.error('查询 users 异常：', err);
    return {
      code: -1,
      data: null,
      msg: '查询失败：' + err.message,
    };
  }
};