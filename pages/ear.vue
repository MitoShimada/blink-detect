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
      <canvas
        id="live-canvas"
        class="c_canvas"
        width="480"
        height="370"
      />
      <canvas
        id="face-canvas"
        class="c_canvas__face"
        width="370"
        height="370"
      />
    </v-flex>
    <v-flex xs8>
      <sleep-info :sleep="sleep" />
      <v-card>
        <v-card-text>
          <p>EAR(Eye Aspect Ratio)は、目尻と目頭の高さの平均と目の横幅の比率で、目を閉じているか否かを判定するアルゴリズムです。</p>
          <p>このデモではあまり精度が出ていませんし、EARの閾値に個人差があります。landmarksのモデルをもっと高性能なものに変えれば良くなるかもしれません。</p>
          <p>論文: http://vision.fe.uni-lj.si/cvww2016/proceedings/papers/05.pdf</p>
          <v-slider
            v-model="threshold"
            :max="0.40"
            :min="0.20"
            :step="0.01"
            label="EAR Threshold"
            prepend-icon="mdi-eye"
            thumb-label="always"
            ticks
          />
          <p>目が細い人は小さくすると良いです。</p>
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
      fps: 1,
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
      threshold: 0.32
      // eslint-disable-next-line new-cap,no-undef
    }
  },
  computed: {
  },
  watch: {
    fps (newFps) {
      const videoDiv = document.getElementById('live-video')
      const canvasDiv = document.getElementById('live-canvas')
      const faceCanvasDiv = document.getElementById('face-canvas')
      const canvasCtx = canvasDiv.getContext('2d')
      const faceCanvasCtx = faceCanvasDiv.getContext('2d')
      this.start(videoDiv, canvasDiv, canvasCtx, faceCanvasDiv, faceCanvasCtx, newFps)
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
    start (videoDiv, canvasDiv, canvasCtx, faceCanvasDiv, faceCanvasCtx, fps) {
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
          landmarksEnabled: false,
          descriptorsEnabled: self.withOptions.find(o => o === 2) === 2,
          expressionsEnabled: self.withOptions.find(o => o === 3) === 3
        }
        const detections = await self.$store.dispatch('face/getFaceDetections', { canvas: canvasDiv, options })
        if (detections.length) {
          if (self.isProgressActive) {
            self.increaseProgress()
            self.isProgressActive = false
          }
          const detection = detections[0]
          await self.$store.dispatch('face/drawEyes', {
            canvasDiv, canvasCtx, faceCanvasCtx, faceCanvasDiv, detection, options
          }).then((__result) => {
            if (!__result) { return }
            const result = (__result.leftEAR + __result.rightEAR) / 2 >= self.threshold ? 'awake' : 'sleep'
            self.pushSleepDetectResult(result)
          })
          if (!this.detectTimer) {
            this.detectTimer = setTimeout(this.sleepDetect, 2000)
          }
        }
        const t1 = performance.now()
        self.duration = (t1 - t0).toFixed(2)
        self.realFps = (1000 / (t1 - t0)).toFixed(2)
      }, 1000 / fps)
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
        this.speak('眠気を検知しました。')
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
          const faceCanvasDiv = document.getElementById('face-canvas')
          const canvasCtx = canvasDiv.getContext('2d')
          const faceCanvasCtx = faceCanvasDiv.getContext('2d')
          videoDiv.srcObject = stream
          self.increaseProgress()
          self.start(videoDiv, canvasDiv, canvasCtx, faceCanvasDiv, faceCanvasCtx, self.fps)
        })
    },
    increaseProgress () {
      const self = this
      self.progress = (100 / self.step) * ++self.counter
    },
    async closeDemo () {
      await this.$store.dispatch('user/logout', { name: this.user.name })
      await this.$router.push('/')
    },
  }
}
</script>
<style scoped>
.l_canvas {
  text-align: center;
}
</style>
