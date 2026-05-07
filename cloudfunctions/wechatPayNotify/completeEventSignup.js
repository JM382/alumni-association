/**
 * 活动报名：wechat_pay_orders 已为 PAID 后，将 pending_payment 报名转为 completed（幂等）
 * 供 wechatPayOrder 轮询同步、wechatPayNotify 支付成功共用（与 events 内积分逻辑保持一致）
 */
const cloud = require('wx-server-sdk');

const SIGNUP_REWARD_POINTS = 10;

async function findUserDocByUserId(db, userId) {
  const usersCol = db.collection('users');
  if (!userId) return null;
  const byUserId = await usersCol.where({ user_id: userId }).limit(1).get();
  if (byUserId.data && byUserId.data.length > 0) return byUserId.data[0];
  try {
    const byDocId = await usersCol.doc(userId).get();
    return byDocId.data || null;
  } catch (e) {
    return null;
  }
}

async function applyPointsChange(db, userId, change, title, desc, source, extra) {
  const usersCol = db.collection('users');
  const pointsLogsCol = db.collection('points_logs');
  const userDoc = await findUserDocByUserId(db, userId);
  if (!userDoc) return;

  const docId = userDoc._id;
  const oldBalance = typeof userDoc.pointsBalance === 'number' ? userDoc.pointsBalance : 0;
  const nextBalance = Math.max(0, oldBalance + change);
  const realChange = nextBalance - oldBalance;
  if (realChange === 0) return;

  await usersCol.doc(docId).update({
    data: {
      pointsBalance: nextBalance,
      pointsUpdatedAt: db.serverDate(),
    },
  });

  await pointsLogsCol.add({
    data: {
      userId,
      change: realChange,
      type: realChange > 0 ? 'earn' : 'spend',
      source,
      title,
      desc,
      extra: extra || {},
      createdAt: db.serverDate(),
    },
  });
}

async function completePaidEventSignupIfNeeded(payOrder) {
  if (!payOrder || payOrder.bizType !== 'event_signup' || !payOrder.bizId) {
    return { done: false, reason: 'skip' };
  }

  const db = cloud.database();
  const _ = db.command;
  const signupsCol = db.collection('event_signups');
  const eventsCol = db.collection('events');

  const signupId = payOrder.bizId;
  const sRes = await signupsCol.doc(signupId).get();
  const s = sRes.data;
  if (!s) return { done: false, reason: 'no_signup' };
  if (s.status !== 'pending_payment') return { done: true, reason: 'already_final' };

  const expectedFen = Number(payOrder.amountFen) || 0;
  const fromSignupFen = Math.max(1, Math.round(Number(s.amount || 0) * 100));
  if (expectedFen > 0 && fromSignupFen !== expectedFen) {
    console.error('completePaidEventSignup amount mismatch', { expectedFen, fromSignupFen, signupId });
    return { done: false, reason: 'amount_mismatch' };
  }

  const now = db.serverDate();
  const userId = s.userId;
  const eventId = s.eventId;
  const peopleCount = Math.max(1, Number(s.peopleCount) || 1);

  await signupsCol.doc(signupId).update({
    data: {
      status: 'completed',
      paidAt: now,
      updatedAt: now,
      pointsAwarded: SIGNUP_REWARD_POINTS,
    },
  });

  if (eventId) {
    await eventsCol.doc(eventId).update({
      data: {
        participantCount: _.inc(peopleCount),
        updatedAt: now,
      },
    });
  }

  const eRes = eventId ? await eventsCol.doc(eventId).get() : { data: null };
  const ev = eRes.data || {};
  await applyPointsChange(
    db,
    userId,
    SIGNUP_REWARD_POINTS,
    '活动报名',
    `报名活动《${ev.title || '活动'}》奖励${SIGNUP_REWARD_POINTS}积分`,
    'event_signup',
    { eventId, signupId }
  );

  return { done: true, reason: 'completed' };
}

module.exports = { completePaidEventSignupIfNeeded };
