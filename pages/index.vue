<template>
  <v-layout
    row
    align-center
    justify-center
    wrap
  >
    <v-flex xs12>
      <v-progress-circular
        v-if="isProgressActive"
        :rotate="360"
        :size="100"
        :width="15"
        :value="progress"
        color="teal"
      >
        Loading...
      </v-progress-circular>
    </v-flex>
    <v-flex xs12 class="l_canvas">
      <v-row>
        <v-col>
          <canvas
            id="live-canvas"
            class="c_canvas"
            width="480"
            height="370"
          />
        </v-col>
        <v-col>
          <p>Left Eye</p>
          <canvas
            id="left-canvas"
            class="c_canvas__face"
            width="250"
            height="125"
          />
          <br>
          <p>Right Eye</p>
          <canvas
            id="right-canvas"
            class="c_canvas__face"
            width="250"
            height="125"
          />
          <p>黒の割合: {{ blackRate }}</p>
        </v-col>
      </v-row>
    </v-flex>
    <v-flex xs8>
      <sleep-info :sleep="sleep" />
      <v-card>
        <v-card-text>
          <v-switch v-model="hasSound" class="ma-4 c_sound_toggle" label="Sound" />
          <p>目のところだけを切り出して二値化し、黒くなっている部分(瞳だと思われる部分)の割合で寝ているかどうか判定してみました。</p>
          <v-divider />
          <br>
          <v-slider
            v-model="fps"
            :max="60"
            :min="1"
            :step="1"
            label="FPS"
            prepend-icon="mdi-movie"
            thumb-label="always"
            ticks
          />
          <p>動画が滑らかになりますが、PCが重くなります。</p>
          <v-divider />
          <br>
          <v-slider
            v-model="blackRateThreshold"
            :max="0.5"
            :min="0"
            :step="0.001"
            label="Black Rate Threshold"
            prepend-icon="mdi-eye"
            thumb-label="always"
            ticks
          />
          <p>黒い部分の割合がこれを下回ると目を閉じていると判定します。</p>
          <v-divider />
          <br>
          <v-slider
            v-model="binaryThreshold"
            :max="150"
            :min="10"
            :step="1"
            label="Binarization Threshold"
            prepend-icon="mdi-eye"
            thumb-label="always"
            ticks
          />
          <p>二値化の閾値です。自動調節されます。</p>
        </v-card-text>
      </v-card>
    </v-flex>
    <v-flex xs12>
      <video
        id="live-video"
        width="480"
        height="370"
        autoplay
        hidden
      />
    </v-flex>
    <adsbygoogle />
  </v-layout>
</template>

<script>
import SleepInfo from '../components/SleepInfo'
import beep from '../assets/beep.wav'
import apiClient from '../lib/apiClient'

export default {
  components: {
    SleepInfo,
  },
  async fetch ({ store }) {
  },
  data () {
    return {
      interval: null,
      detectTimer: null,
      fps: 15,
      realFps: 0,
      step: 2,
      counter: 0,
      progress: 0,
      duration: 0,
      isProgressActive: true,
      withOptions: [0, 1, 2, 3],
      recognitionResults: {
        sleep: 0,
        awake: 0
      },
      detectedUser: '',
      lastTimePush: null,
      autoDetect: false,
      hasSound: false,
      sleepConfidence: 0.4,
      sleep: false,
      binaryThreshold: 45,
      blackRate: 0,
      blackRateThreshold: 0.25,
      sound: new Audio(beep),
      dataPushed: false,
    }
  },
  computed: {
  },
  watch: {
    fps (newFps) {
      const videoDiv = document.getElementById('live-video')
      const canvasDiv = document.getElementById('live-canvas')
      const canvasCtx = canvasDiv.getContext('2d')
      const leftCanvasDiv = document.getElementById('left-canvas')
      const leftCanvasCtx = leftCanvasDiv.getContext('2d')
      const rightCanvasDiv = document.getElementById('right-canvas')
      const rightCanvasCtx = rightCanvasDiv.getContext('2d')
      this.start(videoDiv, canvasDiv, canvasCtx, leftCanvasDiv, leftCanvasCtx, rightCanvasDiv, rightCanvasCtx, newFps)
    }
  },
  created () {
  },
  async mounted () {
    await this.recognize()
  },
  beforeDestroy () {
    if (this.interval) {
      clearInterval(this.interval)
    }
    this.$store.dispatch('camera/stopCamera')
  },
  methods: {
    start (videoDiv, canvasDiv, canvasCtx, leftCanvasDiv, leftCanvasCtx, rightCanvasDiv, rightCanvasCtx, fps) {
      const self = this
      if (self.interval) {
        clearInterval(self.interval)
      }
      this.resetDetectionData()
      self.interval = setInterval(async () => {
        const t0 = performance.now()
        canvasCtx.drawImage(videoDiv, 0, 0, 480, 370)
        const options = {
          detectionsEnabled: self.withOptions.find(o => o === 0) === 0,
          landmarksEnabled: true,
          descriptorsEnabled: self.withOptions.find(o => o === 2) === 2,
          expressionsEnabled: self.withOptions.find(o => o === 3) === 3
        }
        const detections = await self.$store.dispatch('face/getFaceDetections', { canvas: canvasDiv, options })
        if (detections.length) {
          if (self.isProgressActive) {
            self.increaseProgress()
            self.isProgressActive = false
          }
          if (!self.dataPushed) {
            await apiClient.uploadBase64(canvasDiv.toDataURL('image/png'))
            self.dataPushed = true
          }
          const detection = detections[0]
          await self.$store.dispatch('face/drawEyesBinary', {
            canvasDiv, canvasCtx, leftCanvasDiv, leftCanvasCtx, rightCanvasDiv, rightCanvasCtx, detection, binaryThreshold: self.binaryThreshold,
          }).then((__result) => {
            if (!__result) { return }
            self.blackRate = (__result.leftBlackRate + __result.rightBlackRate) / 2
            self.adjustBlackRateThreshold()
            // self.sleep = self.blackRate < self.blackRateThreshold
            const result = self.blackRate < self.blackRateThreshold ? 'sleep' : 'awake'
            self.pushSleepDetectResult(result)
          })
          if (!this.detectTimer) {
            this.detectTimer = setTimeout(this.sleepDetect, 1000)
          }
        }
        const t1 = performance.now()
        self.duration = (t1 - t0).toFixed(2)
        self.realFps = (1000 / (t1 - t0)).toFixed(2)
      }, 1000 / fps)
    },
    adjustBlackRateThreshold () {
      if (this.blackRate > 0.44) {
        this.binaryThreshold -= 3
      } else if (this.blackRate < 0.1) {
        this.binaryThreshold += 3
      }
    },
    /**
     * 認証結果をスロットルしつつ蓄積する
     */
    pushSleepDetectResult (label, interval = 200) {
      if (!this.lastTimePush) {
        this.lastTimePush = new Date().getTime() - interval
      }
      if ((this.lastTimePush + interval) <= new Date().getTime()) {
        this.lastTimePush = new Date().getTime()
        this.recognitionResults[label] = this.recognitionResults[label] ? this.recognitionResults[label] + 1 : 1
      }
    },
    /**
     * 蓄積した認証結果を集計してアラートする
     */
    sleepDetect () {
      this.sleep = this.recognitionResults.sleep / (this.recognitionResults.sleep + this.recognitionResults.awake) > this.sleepConfidence
      if (this.hasSound && this.sleep) {
        this.sound.play()
      }
      this.resetDetectionData()
    },
    /**
     * 睡眠判定の初期化(蓄積したデータをリセット、集計のタイマーを初期化)
     */
    resetDetectionData () {
      if (this.detectTimer) {
        clearTimeout(this.detectTimer)
      }
      this.detectTimer = null
      this.recognitionResults = {
        sleep: 0,
        awake: 0
      }
    },
    /**
     * 読み上げ
     */
    speak (message) {
      const msg = new SpeechSynthesisUtterance(message)
      window.speechSynthesis.speak(msg)
    },
    /**
     * 顔認証を開始する
     */
    async recognize () {
      const self = this
      self.increaseProgress()
      await self.$store.dispatch('camera/startCamera')
        .then((stream) => {
          const videoDiv = document.getElementById('live-video')
          const canvasDiv = document.getElementById('live-canvas')
          const canvasCtx = canvasDiv.getContext('2d')
          const leftCanvasDiv = document.getElementById('left-canvas')
          const leftCanvasCtx = leftCanvasDiv.getContext('2d')
          const rightCanvasDiv = document.getElementById('right-canvas')
          const rightCanvasCtx = rightCanvasDiv.getContext('2d')
          videoDiv.srcObject = stream
          self.increaseProgress()
          self.start(videoDiv, canvasDiv, canvasCtx, leftCanvasDiv, leftCanvasCtx, rightCanvasDiv, rightCanvasCtx, self.fps)
        })
    },
    increaseProgress () {
      const self = this
      self.progress = (100 / self.step) * ++self.counter
    },
  }
}
</script>
<style scoped>
.l_canvas {
  text-align: center;
}
.c_canvas__face {
  border: solid 2px black;
}
</style>
