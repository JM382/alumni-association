const cloud = require('wx-server-sdk')
const crypto = require('crypto')
const https = require('https')
const { URL } = require('url')

cloud.init({ env: 'cloud1-7g1x07md7360212c' })

const MCH_ID = String(process.env.WXPAY_MCH_ID || '').trim()
const API_V3_KEY = process.env.WXPAY_API_V3_KEY || ''
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

/** serial_no -> PEM（平台证书），内存缓存避免每次通知都请求 /v3/certificates */
let platformCertPemBySerial = null
let platformCertFetchedAt = 0
const CERT_CACHE_MS = 60 * 60 * 1000

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

function decryptAes256Gcm(aesKeyUtf8, associatedData, nonceStr, ciphertextB64) {
  const key = Buffer.from(aesKeyUtf8, 'utf8')
  if (key.length !== 32) {
    throw new Error('WXPAY_API_V3_KEY 须为 32 位')
  }
  const buf = Buffer.from(ciphertextB64, 'base64')
  const authTag = buf.subarray(buf.length - 16)
  const data = buf.subarray(0, buf.length - 16)
  const iv = Buffer.from(nonceStr, 'utf8')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  decipher.setAAD(Buffer.from(associatedData || '', 'utf8'))
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
  return decrypted.toString('utf8')
}

async function loadPlatformCertificates(force) {
  const now = Date.now()
  if (!force && platformCertPemBySerial && now - platformCertFetchedAt < CERT_CACHE_MS) {
    return platformCertPemBySerial
  }
  const path = '/v3/certificates'
  const header = authHeader('GET', path, '')
  const wxRes = await httpsRequest(`https://api.mch.weixin.qq.com${path}`, {
    method: 'GET',
    headers: {
      Authorization: header,
      Accept: 'application/json',
      'User-Agent': 'miniprogram-alumni/1.0',
    },
  })
  const text = wxRes.text
  let json = {}
  try {
    json = parseJson(text)
  } catch (e) {
    throw new Error(`拉取平台证书失败: 非 JSON ${text.slice(0, 200)}`)
  }
  if (!wxRes.ok || !Array.isArray(json.data)) {
    throw new Error(`拉取平台证书失败: ${text.slice(0, 300)}`)
  }
  const map = {}
  for (const row of json.data) {
    const enc = row.encrypt_certificate
    if (!enc || !row.serial_no) continue
    const pem = decryptAes256Gcm(API_V3_KEY, enc.associated_data, enc.nonce, enc.ciphertext)
    map[row.serial_no] = pem
  }
  platformCertPemBySerial = map
  platformCertFetchedAt = now
  return map
}

function parseJson(s) {
  return JSON.parse(s || '{}')
}

function getHeader(headers, name) {
  const lower = name.toLowerCase()
  if (!headers) return ''
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === lower) return String(headers[k] || '')
  }
  return ''
}

function verifyNotifySignature(pem, timestamp, nonce, bodyRaw, signatureB64) {
  const message = `${timestamp}\n${nonce}\n${bodyRaw}\n`
  const verify = crypto.createVerify('SHA256')
  verify.update(message)
  verify.end()
  const key = crypto.createPublicKey(pem)
  return verify.verify(key, signatureB64, 'base64')
}

function httpResp(statusCode, bodyObj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(bodyObj),
  }
}

async function markOrderPaid(outTradeNo, transactionId) {
  const db = cloud.database()
  const { data: orders } = await db.collection('donation_orders').where({ outTradeNo }).limit(1).get()
  const order = orders && orders.length > 0 ? orders[0] : null
  if (!order) {
    console.warn('wxpayDonateNotify: 无本地订单', outTradeNo)
    return
  }
  if (order.status === 'success') {
    return
  }
  await db.collection('donation_orders').doc(order._id).update({
    data: {
      status: 'success',
      transactionId: transactionId || '',
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
          transactionId: transactionId || '',
        },
        createdAt: db.serverDate(),
      },
    })
  }
}

function isHttpTrigger(event) {
  return !!(event && (event.httpMethod || event.requestContext || event.headers))
}

exports.main = async (event) => {
  if (!isHttpTrigger(event)) {
    return { ok: false, errMsg: '本函数仅用于微信支付 HTTP 回调；请在云开发控制台为「HTTP 访问」配置后，将 URL 填入 WXPAY_NOTIFY_URL' }
  }

  if (!MCH_ID || !API_V3_KEY || !MCH_SERIAL_NO || !MCH_PRIVATE_KEY) {
    return httpResp(500, {
      code: 'FAIL',
      message: '云函数环境变量缺少 WXPAY_MCH_ID / WXPAY_API_V3_KEY / WXPAY_MCH_SERIAL_NO / WXPAY_MCH_PRIVATE_KEY',
    })
  }
  if (!/-----BEGIN (RSA )?PRIVATE KEY-----/.test(MCH_PRIVATE_KEY)) {
    return httpResp(500, { code: 'FAIL', message: 'WXPAY_MCH_PRIVATE_KEY PEM 格式错误' })
  }

  const method = (event.httpMethod || event.requestContext?.http?.method || 'GET').toUpperCase()
  const headers = event.headers || {}

  if (method === 'GET' || method === 'HEAD') {
    return httpResp(200, { code: 'SUCCESS', message: 'wxpay donate notify ok' })
  }

  if (method !== 'POST') {
    return httpResp(405, { code: 'FAIL', message: 'method not allowed' })
  }

  let rawBody = event.body
  if (event.isBase64Encoded && typeof rawBody === 'string') {
    rawBody = Buffer.from(rawBody, 'base64').toString('utf8')
  }
  if (typeof rawBody !== 'string') {
    return httpResp(400, { code: 'FAIL', message: 'body must be raw json string' })
  }

  const ts = getHeader(headers, 'Wechatpay-Timestamp')
  const nonce = getHeader(headers, 'Wechatpay-Nonce')
  const sig = getHeader(headers, 'Wechatpay-Signature')
  const serial = getHeader(headers, 'Wechatpay-Serial')

  if (!ts || !nonce || !sig || !serial) {
    return httpResp(401, { code: 'FAIL', message: 'missing wechatpay headers' })
  }

  let certs = await loadPlatformCertificates(false)
  let pem = certs[serial]
  if (!pem) {
    certs = await loadPlatformCertificates(true)
    pem = certs[serial]
  }
  if (!pem) {
    return httpResp(401, { code: 'FAIL', message: 'unknown certificate serial' })
  }

  let verified = verifyNotifySignature(pem, ts, nonce, rawBody, sig)
  if (!verified) {
    certs = await loadPlatformCertificates(true)
    pem = certs[serial]
    if (pem) verified = verifyNotifySignature(pem, ts, nonce, rawBody, sig)
  }
  if (!verified) {
    return httpResp(401, { code: 'FAIL', message: 'signature verify failed' })
  }

  let notify
  try {
    notify = parseJson(rawBody)
  } catch (e) {
    return httpResp(400, { code: 'FAIL', message: 'invalid json body' })
  }

  const eventType = notify.event_type || ''
  if (eventType !== 'TRANSACTION.SUCCESS') {
    return httpResp(200, { code: 'SUCCESS', message: '成功' })
  }

  const res = notify.resource
  if (!res || res.algorithm !== 'AEAD_AES_256_GCM') {
    return httpResp(400, { code: 'FAIL', message: 'unsupported resource' })
  }

  let plain
  try {
    plain = decryptAes256Gcm(API_V3_KEY, res.associated_data, res.nonce, res.ciphertext)
  } catch (e) {
    console.error('wxpayDonateNotify decrypt', e)
    return httpResp(500, { code: 'FAIL', message: 'decrypt failed' })
  }

  let trade
  try {
    trade = parseJson(plain)
  } catch (e) {
    return httpResp(400, { code: 'FAIL', message: 'invalid decrypted payload' })
  }

  if (trade.trade_state !== 'SUCCESS') {
    return httpResp(200, { code: 'SUCCESS', message: '成功' })
  }

  const outTradeNo = trade.out_trade_no || ''
  if (!outTradeNo.startsWith('donate_')) {
    return httpResp(200, { code: 'SUCCESS', message: '成功' })
  }

  if (trade.mchid && String(trade.mchid) !== String(MCH_ID)) {
    return httpResp(400, { code: 'FAIL', message: 'mchid mismatch' })
  }

  try {
    await markOrderPaid(outTradeNo, trade.transaction_id || '')
  } catch (e) {
    console.error('wxpayDonateNotify db', e)
    return httpResp(500, { code: 'FAIL', message: 'db error' })
  }

  return httpResp(200, { code: 'SUCCESS', message: '成功' })
}
