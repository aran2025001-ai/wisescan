import CryptoJS from 'crypto-js'

const APP_ID = import.meta.env.VITE_TENCENT_APPID as string
const SECRET_ID = import.meta.env.VITE_TENCENT_SECRET_ID as string
const SECRET_KEY = import.meta.env.VITE_TENCENT_SECRET_KEY as string

/**
 * 生成腾讯云 ASR WebSocket 签名
 * 算法与官方 SDK speechrecognizer.js 完全一致：
 *   签名原文 = "asr.cloud.tencent.com/asr/v2/{appid}?{按字典序排序的参数}"
 *   签名 = btoa(Uint8Array_to_String(HmacSHA1(签名原文, SecretKey)))
 */
function generateSignature(params: Record<string, string | number>): string {
  const sortedKeys = Object.keys(params).sort()
  const queryString = sortedKeys.map((key) => `${key}=${params[key]}`).join('&')
  const signStr = `asr.cloud.tencent.com/asr/v2/${APP_ID}?${queryString}`

  const hash = CryptoJS.HmacSHA1(signStr, SECRET_KEY)

  // WordArray → Uint8Array（官方 SDK asrauthentication.js 同款）
  const bytes = new Uint8Array(hash.sigBytes)
  for (let i = 0; i < hash.sigBytes; i++) {
    bytes[i] = (hash.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff
  }

  // Uint8Array → 二进制字符串 → btoa
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * 构建腾讯云 ASR WebSocket 连接 URL
 */
export function buildAsrUrl(voiceId: string): string {
  const timestamp = Math.floor(Date.now() / 1000)
  const expired = timestamp + 600 // 10 分钟后过期
  const nonce = Math.floor(Math.random() * 9000000000 + 1000000000)

  const params: Record<string, string | number> = {
    secretid: SECRET_ID,
    timestamp,
    expired,
    nonce,
    engine_model_type: '16k_zh', // 必填
    voice_id: voiceId,           // 必填：16位或UUID格式均可（文档示例用的是UUID）
    voice_format: 1,             // 显式指定 PCM 格式
  }

  // 签名（参数按字典序排序，值不编码）
  const signature = generateSignature(params)

  // URL 参数（参数值做 URL 编码）
  const queryString = Object.keys(params)
    .sort()
    .map((key) => `${key}=${encodeURIComponent(String(params[key]))}`)
    .join('&')

  return `wss://asr.cloud.tencent.com/asr/v2/${APP_ID}?${queryString}&signature=${encodeURIComponent(signature)}`
}

/** 生成 voice_id（UUID v4 格式，与官方示例一致） */
function generateVoiceId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export interface TencentAsrCallbacks {
  /** 实时识别结果（slice_type=2 的稳态文字） */
  onResult: (text: string) => void
  /** 错误回调 */
  onError: (error: string) => void
  /** 开始录音回调 */
  onStart: () => void
  /** 结束录音回调，携带最终识别文字（微信模式：松手自动发送） */
  onEnd: (finalText: string) => void
}

/**
 * 腾讯云实时语音识别客户端
 *
 * 核心流程：
 * 1. 获取麦克风权限 → AudioContext 采集音频
 * 2. WebSocket 直连腾讯云 ASR
 * 3. 实时返回识别结果（仅取 slice_type=2 的稳态结果）
 * 4. 松手后停止录音
 */
export class TencentAsrClient {
  private ws: WebSocket | null = null
  private onResult: (text: string) => void
  private onError: (error: string) => void
  private onStart: () => void
  private onEnd: (finalText: string) => void
  private voiceId: string
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private isRecording = false
  private lastText = ''  // 累积的最终识别文字（松手时通过 onEnd 传出）
  private isStopping = false
  private stopTimer: number | null = null

  constructor(callbacks: TencentAsrCallbacks) {
    this.onResult = callbacks.onResult
    this.onError = callbacks.onError
    this.onStart = callbacks.onStart
    this.onEnd = callbacks.onEnd
    this.voiceId = generateVoiceId()
  }

  async startRecording(): Promise<void> {
    console.log('[ASR] 🎤 开始启动录音...')
    try {
      // 获取麦克风权限（指定 16000Hz 单声道，确保采样率匹配腾讯云 ASR）
      console.log('[ASR] 🎤 请求麦克风权限...')
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: { ideal: 16000 },
          channelCount: { ideal: 1 },
          echoCancellation: true,
          noiseSuppression: true,
        }
      })
      this.audioContext = new AudioContext({ sampleRate: 16000 })
      console.log(`[ASR] ✅ 麦克风权限已获取，实际采样率: AudioContext=${this.audioContext.sampleRate}Hz`)

      const source = this.audioContext.createMediaStreamSource(this.mediaStream)
      const processor = this.audioContext.createScriptProcessor(4096, 1, 1)

      // 建立 WebSocket 连接（voice_id 通过 URL 参数传递）
      const wsUrl = buildAsrUrl(this.voiceId)
      console.log('[ASR] 连接地址:', wsUrl.replace(/signature=[^&]+/, 'signature=***'))
      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        console.log('[ASR] ✅ WebSocket 已连接')
        // 防止竞态：用户松手后 stopRecording 已调用，此时 onopen 不应再触发 onStart
        if (!this.isRecording) return
        this.onStart()
        // voice_id 已在 URL 参数中，无需额外握手包
      }

      this.ws.onmessage = (event) => {
        if (typeof event.data !== 'string') return
        try {
          const data = JSON.parse(event.data)
          if (data.code !== 0) {
            console.error(`[ASR] ❌ 错误: code=${data.code} message=${data.message}`)
            this.onError(data.message || '语音识别错误')
            return
          }
          // slice_type: 0=开始, 1=中间结果, 2=结束句识别
          // 只保留错误日志，正常识别结果不打印（避免控制台刷屏）
          // slice_type: 0=开始, 1=中间结果(流式), 2=最终结果(稳态)
          // 只要有文字就保存（松手时通过 onEnd 传出最终版本）
          if (data.result?.voice_text_str) {
            this.lastText = data.result.voice_text_str
            this.onResult(data.result.voice_text_str)
          }
          // 松手后收到稳态结果 → 立即结束等待，确保完整文字
          if (data.result?.slice_type === 2 && this.isStopping) {
            console.log(`[ASR] ⚡ 收到稳态结果，立即结束: "${this.lastText}"`)
            if (this.stopTimer) { clearTimeout(this.stopTimer); this.stopTimer = null }
            this.isStopping = false
            this.onEnd(this.lastText)
            this.cleanup()
          }
        } catch {
          // 非 JSON 格式消息，忽略
        }
      }

      this.ws.onerror = (e) => {
        console.error('[ASR] ❌ WebSocket 错误:', e)
        this.onError('语音服务连接失败，请检查网络后重试')
      }

      this.ws.onclose = (e) => {
        console.log(`[ASR] 🔌 WebSocket 关闭: code=${e.code} reason=${e.reason}`)
        this.isRecording = false
        // 清理等待定时器（如果还在等 slice_type=2）
        if (this.stopTimer) { clearTimeout(this.stopTimer); this.stopTimer = null }
        if (this.isStopping) {
          // S退出手等待，用已有文字
          this.isStopping = false
          this.onEnd(this.lastText)
        }
        this.cleanup()
      }

      // 音频数据处理：每 40ms 发送 PCM 数据包（16000Hz，16bit，单声道）
      let chunkCount = 0
      const actualRate = this.audioContext.sampleRate
      processor.onaudioprocess = (e) => {
        if (!this.isRecording || this.ws?.readyState !== WebSocket.OPEN) return
        const inputData = e.inputBuffer.getChannelData(0)
        
        // 如果 AudioContext 采样率不是 16000Hz，需要降采样
        let pcmData: Int16Array
        if (actualRate === 16000) {
          pcmData = new Int16Array(inputData.length)
          for (let i = 0; i < inputData.length; i++) {
            pcmData[i] = Math.max(-32768, Math.min(32767, Math.round(inputData[i] * 32768)))
          }
        } else {
          // 降采样到 16000Hz
          const ratio = actualRate / 16000
          const outLen = Math.floor(inputData.length / ratio)
          pcmData = new Int16Array(outLen)
          for (let i = 0; i < outLen; i++) {
            const srcIdx = Math.round(i * ratio)
            pcmData[i] = Math.max(-32768, Math.min(32767, Math.round(inputData[srcIdx] * 32768)))
          }
        }
        this.ws?.send(pcmData.buffer as ArrayBuffer)
        chunkCount++
        if (chunkCount <= 3) {
          console.log(`[ASR] 📤 音频块 #${chunkCount}: ${pcmData.length} samples @${actualRate}Hz → ${(pcmData.length / 16).toFixed(0)}ms`)
        }
      }

      source.connect(processor)
      processor.connect(this.audioContext.destination)

      // ✅ 音频管线搭好后标记开始录音（放这里因为如果 stopRecording 提前调用会置 false）
      this.isRecording = true
    } catch (error) {
      const errMsg = error instanceof DOMException && error.name === 'NotAllowedError'
        ? '麦克风权限被拒绝，请在浏览器设置中允许麦克风访问'
        : '无法访问麦克风，请检查设备连接'
      this.onError(errMsg)
      this.onEnd('') // 出错也要重置按钮状态，否则永远卡在蓝色
      console.error('[ASR] 录音启动失败:', error)
    }
  }

  stopRecording(): void {
    this.isRecording = false
    // 发送结束标识（腾讯云 ASR 协议：发送 {"type":"end"}）
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: 'end' }))
      } catch {
        // 忽略发送失败
      }
    }
    // ⏳ 等待 ASR 返回最终识别结果（最多 800ms），避免松手后结果丢失
    this.isStopping = true
    const finalize = () => {
      if (!this.isStopping) return // 已经由 slice_type=2 触发了
      this.isStopping = false
      this.onEnd(this.lastText)
      this.cleanup()
    }
    this.stopTimer = window.setTimeout(finalize, 800)
  }

  private cleanup(): void {
    if (this.stopTimer) { clearTimeout(this.stopTimer); this.stopTimer = null }
    if (this.ws) {
      this.ws.onopen = null
      this.ws.onmessage = null
      this.ws.onerror = null
      this.ws.onclose = null
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close()
      }
      this.ws = null
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {})
      this.audioContext = null
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop())
      this.mediaStream = null
    }
  }
}
