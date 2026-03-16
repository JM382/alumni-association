// 云函数 updateNotificationSettings：按当前用户 user_id 更新 notification_settings 集合
// 有则 update，无则 add 一条；与消息通知页的 6 个开关一致
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const usersCol = db.collection('users');
const settingsCol = db.collection('notification_settings');

const SETTING_KEYS = ['activityOn', 'systemOn', 'interactOn', 'circleOn', 'soundOn', 'vibrateOn'];

function resolveUserId(doc) {
  return (doc && (doc.user_id || doc._id)) || '';
}

exports.main = async (event, context) => {
  try {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) {
      return { success: false, error: '未获取到用户身份' };
    }

    const userRes = await usersCol.where({ openid: OPENID }).limit(1).get();
    if (!userRes.data || userRes.data.length === 0) {
      return { success: false, error: '用户不存在' };
    }
    const user_id = resolveUserId(userRes.data[0]);

    const dataToSet = {};
    SETTING_KEYS.forEach((key) => {
      if (event[key] !== undefined) {
        dataToSet[key] = !!event[key];
      }
    });
    dataToSet.updateTime = db.serverDate();

    const existRes = await settingsCol.where({ userId: user_id }).limit(1).get();

    if (existRes.data && existRes.data.length > 0) {
      const docId = existRes.data[0]._id;
      if (Object.keys(dataToSet).length > 1) {
        await settingsCol.doc(docId).update({ data: dataToSet });
      }
      const updated = await settingsCol.doc(docId).get();
      return { success: true, settings: updated.data };
    }

    const newDoc = {
      userId: user_id,
      activityOn: event.activityOn !== undefined ? !!event.activityOn : true,
      systemOn: event.systemOn !== undefined ? !!event.systemOn : true,
      interactOn: event.interactOn !== undefined ? !!event.interactOn : true,
      circleOn: event.circleOn !== undefined ? !!event.circleOn : true,
      soundOn: event.soundOn !== undefined ? !!event.soundOn : true,
      vibrateOn: event.vibrateOn !== undefined ? !!event.vibrateOn : true,
      updateTime: db.serverDate(),
    };
    await settingsCol.add({ data: newDoc });
    return { success: true, settings: newDoc };
  } catch (e) {
    console.error('updateNotificationSettings 异常', e);
    return { success: false, error: e.message || '更新失败' };
  }
};
