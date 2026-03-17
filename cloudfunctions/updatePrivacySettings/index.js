// 云函数 updatePrivacySettings：按当前用户 user_id 更新 privacy_settings 集合
// 有则 update，无则 add 一条；字段与隐私设置页的 6 个开关一致
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const usersCol = db.collection('users');
const settingsCol = db.collection('privacy_settings');

// 和页面一致的字段
const SETTING_KEYS = [
  'phoneVisible',
  'emailVisible',
  'workVisible',
  'searchable',
  'dmFromNonFriend',
  'circleFriendsOnly',
];

function resolveUserId(doc) {
  return (doc && (doc.user_id || doc._id)) || '';
}

exports.main = async (event, context) => {
  try {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) {
      return { success: false, error: '未获取到用户身份' };
    }

    // 找当前用户 user_id
    const userRes = await usersCol.where({ openid: OPENID }).limit(1).get();
    if (!userRes.data || userRes.data.length === 0) {
      return { success: false, error: '用户不存在' };
    }
    const user_id = resolveUserId(userRes.data[0]);

    // 只收 event 里有的字段
    const dataToSet = {};
    SETTING_KEYS.forEach((key) => {
      if (event[key] !== undefined) {
        dataToSet[key] = !!event[key];
      }
    });
    dataToSet.updateTime = db.serverDate();

    // 已有记录：update
    const existRes = await settingsCol.where({ userId: user_id }).limit(1).get();
    if (existRes.data && existRes.data.length > 0) {
      const docId = existRes.data[0]._id;
      if (Object.keys(dataToSet).length > 1) {
        await settingsCol.doc(docId).update({ data: dataToSet });
      }
      const updated = await settingsCol.doc(docId).get();
      return { success: true, settings: updated.data };
    }

    // 没有记录：add 一条，给没传的字段默认值
    const newDoc = {
      userId: user_id,
      phoneVisible: event.phoneVisible !== undefined ? !!event.phoneVisible : false,
      emailVisible: event.emailVisible !== undefined ? !!event.emailVisible : true,
      workVisible: event.workVisible !== undefined ? !!event.workVisible : true,
      searchable: event.searchable !== undefined ? !!event.searchable : true,
      dmFromNonFriend:
        event.dmFromNonFriend !== undefined ? !!event.dmFromNonFriend : true,
      circleFriendsOnly:
        event.circleFriendsOnly !== undefined ? !!event.circleFriendsOnly : false,
      updateTime: db.serverDate(),
    };

    await settingsCol.add({ data: newDoc });
    return { success: true, settings: newDoc };
  } catch (e) {
    console.error('updatePrivacySettings 异常', e);
    return { success: false, error: e.message || '更新失败' };
  }
};