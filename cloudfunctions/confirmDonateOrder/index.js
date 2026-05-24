const cloud = require('wx-server-sdk')
const crypto = require('crypto')
const https = require('https')
const { URL } = require('url')

cloud.init({ env: 'cloud1-7g1x07md7360212c' })

const MCH_ID = String(process.env.WXPAY_MCH_ID || '').trim()
const MCH_SERIAL_NO = process.env.WXPAY_MCH_SERIAL_NO || ''

function normalizeMerchantPrivateKeyPem(raw) {
  if (!raw || typeof raw !== 'string') return ''
  let s = raw.trim()
  if (!s) return ''
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim()
  }
  s = s.replace(/\r\n/g, '\n')
  s = s.replace(/\\n/g, '\n')
  if (!/\n/.test(s) && /-----BEGIN/.test(s)) {
    s = s.replace(/(-----BEGIN [A-Z ]+-----)\s+/, '$1\n')
    s = s.replace(/\s+(-----END [A-Z ]+-----)/, '\n$1')
  }
  const beginRe = /-----BEGIN [A-Z ]+-----/
  const endRe = /-----END [A-Z ]+-----/
  const bm = beginRe.exec(s)
  const em = endRe.exec(s)
  if (bm && em && em.index > bm.index) {
    const head = bm[0]
    const foot = em[0]
    const inner = s.slice(bm.index + head.length, em.index).replace(/\s+/g, '')
    if (inner) s = `${head}\n${inner}\n${foot}`
  }
  return s.trim()
}

const MCH_PRIVATE_KEY = normalizeMerchantPrivateKeyPem(process.env.WXPAY_MCH_PRIVATE_KEY || '')

function randomStr(len = 32) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let s = ''
  for (let i = 0; i < len; i += 1) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

function signMessage(message) {
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(message)
  signer.end()
  return signer.sign(MCH_PRIVATE_KEY, 'base64')
}

function authHeader(method, urlPath, body) {
  const nonceStr = randomStr(24)
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signText = `${method}\n${urlPath}\n${timestamp}\n${nonceStr}\n${body}\n`
  const signature = signMessage(signText)
  return `WECHATPAY2-SHA256-RSA2048 mchid="${MCH_ID}",nonce_str="${nonceStr}",signature="${signature}",timestamp="${timestamp}",serial_no="${MCH_SERIAL_NO}"`
}

function httpsRequest(urlStr, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr)
    const req = https.request(
      {
        hostname: u.hostname,
        port: 443,
        path: `${u.pathname}${u.search}`,
        method,
        headers,
      },
      (res) => {
        const chunks = []
        res.on('data', (d) => chunks.push(d))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, text })
        })
      }
    )
    req.on('error', reject)
    if (body != null && body !== '') req.write(body)
    req.end()
  })
}

exports.main = async (event) => {
  if (!MCH_ID || !MCH_SERIAL_NO || !MCH_PRIVATE_KEY) {
    return { success: false, errMsg: '支付参数未配置完整（WXPAY_MCH_ID / WXPAY_MCH_SERIAL_NO / WXPAY_MCH_PRIVATE_KEY）' }
  }
  if (!/-----BEGIN (RSA )?PRIVATE KEY-----/.test(MCH_PRIVATE_KEY)) {
    return { success: false, errMsg: 'WXPAY_MCH_PRIVATE_KEY 不是合法 PEM（需 apiclient_key.pem，一行时请用 \\n 换行）' }
  }
  const { outTradeNo = '' } = event || {}
  if (!outTradeNo) return { success: false, errMsg: '缺少 outTradeNo' }

  const path = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}?mchid=${MCH_ID}`
  const header = authHeader('GET', path, '')
  const wxRes = await httpsRequest(`https://api.mch.weixin.qq.com${path}`, {
    method: 'GET',
    headers: {
      Authorization: header,
      Accept: 'application/json',
      'User-Agent': 'miniprogram-alumni/1.0',
    },
  })
  const txt = wxRes.text
  let data = {}
  try {
    data = JSON.parse(txt || '{}')
  } catch (e) {
    return { success: false, errMsg: '查询结果解析失败', raw: txt }
  }
  if (!wxRes.ok) return { success: false, errMsg: '查询支付结果失败', detail: data }

  const tradeState = data.trade_state
  const db = cloud.database()
  const { data: orders } = await db.collection('donation_orders').where({ outTradeNo }).limit(1).get()
  const order = orders && orders.length > 0 ? orders[0] : null
  if (!order) return { success: false, errMsg: '本地订单不存在' }

  if (tradeState === 'SUCCESS') {
    await db.collection('donation_orders').doc(order._id).update({
      data: {
        status: 'success',
        transactionId: data.transaction_id || '',
        updatedAt: db.serverDate(),
      },
    })

    const { data: existingService } = await db.collection('service_orders').where({ type: 'donate', outTradeNo }).limit(1).get()
    if (!existingService || existingService.length === 0) {
      await db.collection('service_orders').add({
        data: {
          _openid: order._openid,
          type: 'donate',
          outTradeNo,
          data: {
            projectId: order.projectId || '',
            projectName: order.projectName || '爱心捐赠',
            amountFen: order.amountFen || 10,
            amountYuan: ((order.amountFen || 10) / 100).toFixed(2),
            payChannel: '微信支付',
            transactionId: data.transaction_id || '',
          },
          createdAt: db.serverDate(),
        },
      })
    }
    return { success: true, paid: true }
  }

  await db.collection('donation_orders').doc(order._id).update({
    data: { status: tradeState || 'unknown', updatedAt: db.serverDate() },
  })
  return { success: true, paid: false, tradeState }
}
