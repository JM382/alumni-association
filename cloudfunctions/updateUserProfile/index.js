// 云函数 updateUserProfile：更新 users 集合中的通用个人信息
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const users = db.collection('users');

exports.main = async (event, context) => {
  try {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) {
      return { success: false, error: '未获取到用户身份' };
    }

    // 注销账号：删除该 openid 对应用户在 users 集合中的整条记录
    if (event.deregister === true) {
      const query = await users.where({ openid: OPENID }).limit(1).get();
      if (!query.data.length) {
        return { success: true }; // 已无记录，视为成功
      }
      const userId = query.data[0]._id;
      await users.doc(userId).remove();
      return { success: true };
    }

    // 允许前端更新的字段（不含学校相关）
    const allowedFields = [
      'nickname', // 昵称，用于个人中心展示
      'mobile',
      'email',
      'gender',
      'birthday',
      'city',
      'bio',
      'avatarUrl',
    ];

    const dataToSet = {};
    allowedFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(event, field)) {
        dataToSet[field] = event[field];
      }
    });

    if (!Object.keys(dataToSet).length) {
      return { success: false, error: '没有需要更新的字段' };
    }

    const query = await users.where({ openid: OPENID }).limit(1).get();
    if (!query.data.length) {
      return { success: false, error: '用户不存在' };
    }

    const doc = query.data[0];
    const userId = doc._id;
    // 注意：写 orders、contacts、point_logs 等集合时，应使用 doc.user_id || doc._id 作为 userId 归属
    await users.doc(userId).update({ data: dataToSet });

    const latest = await users.doc(userId).get();
    return { success: true, user: latest.data };
  } catch (e) {
    console.error('updateUserProfile 异常', e);
    return { success: false, error: e.message || '更新失败' };
  }
};

