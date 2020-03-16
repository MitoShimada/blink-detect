import * as faceapi from 'face-api.js'

export const state = () => ({
  faces: [],
  loading: false,
  loaded: false,
  faceMatcher: null,

  useTiny: false,

  detections: {
    scoreThreshold: 0.1,
    inputSize: 320,
    boxColor: 'blue',
    textColor: 'red',
    lineWidth: 1,
    fontSize: 20,
    fontStyle: 'Georgia'
  },
  expressions: {
    minConfidence: 0.2
  },
  landmarks: {
    drawLines: true,
    lineWidth: 1
  },
  descriptors: {
    withDistance: false
  },
  cachedSleepDetection: null,
})

export const mutations = {
  loading (state) {
    state.loading = true
  },

  load (state) {
    state.loading = false
    state.loaded = true
  },

  setFaces (state, faces) {
    state.faces = faces
  },

  setFaceMatcher (state, matcher) {
    state.faceMatcher = matcher
  }
}

export const actions = {
  load ({ commit, state }) {
    if (!state.loading && !state.loaded) {
      commit('loading')
      return Promise.all([
        faceapi.loadFaceRecognitionModel('/data/models'),
        faceapi.loadFaceLandmarkModel('/data/models'),
        faceapi.loadTinyFaceDetectorModel('/data/models'),
        faceapi.loadFaceExpressionModel('/data/models')
      ])
        .then(() => {
          commit('load')
        })
    }
  },
  getFaceMatcher ({ commit, state }) {
    const labeledDescriptors = []
    state.faces.forEach((face) => {
      const descriptors = face.descriptors.map((desc) => {
        if (desc.descriptor) {
          const descArray = []
          for (const i in desc.descriptor) {
            descArray.push(parseFloat(desc.descriptor[i]))
          }
          return new Float32Array(descArray)
        }
      })
      if (descriptors.length) {
        labeledDescriptors.push(
          new faceapi.LabeledFaceDescriptors(
            face.user,
            descriptors
          ))
      }
    })
    const matcher = new faceapi.FaceMatcher(labeledDescriptors)
    commit('setFaceMatcher', matcher)
    return matcher
  },
  async getFaceDetections ({ commit, state }, { canvas, options }) {
    let detections = faceapi.detectAllFaces(canvas,
      new faceapi.TinyFaceDetectorOptions({
        scoreThreshold: state.detections.scoreThreshold,
        inputSize: state.detections.inputSize
      })
      // new faceapi.SsdMobilenetv1Options({ minConfidence: 0.8 })
    )

    if (options && (options.landmarksEnabled || options.descriptorsEnabled)) {
      detections = detections.withFaceLandmarks(state.useTiny)
    }
    if (options && options.expressionsEnabled) {
      detections = detections.withFaceExpressions()
    }
    if (options && options.descriptorsEnabled) {
      detections = detections.withFaceDescriptors()
    }
    detections = await detections
    return detections
  },
  async drawBox ({ commit, state, dispatch }, { canvasDiv, canvasCtx }) {
    const options = {
      detectionsEnabled: true,
      landmarksEnabled: false,
      descriptorsEnabled: false,
      expressionsEnabled: false
    }
    const detection = await dispatch('face/getFaceDetections', { canvas: canvasDiv, options })
    if (!detection.length) { return }
    const box = detection.detection.box
    canvasCtx.strokeStyle = state.detections.boxColor
    canvasCtx.lineWidth = state.detections.lineWidth
    canvasCtx.strokeRect(box.x, box.y, box.width, box.height)
  },
  async drawEyes ({ commit, state, dispatch }, { canvasDiv, canvasCtx, faceCanvasDiv, faceCanvasCtx, detection }) {
    // canvasの顔のところだけ切り抜いてfaceCanvasに書き込み
    const box = detection.detection.box
    canvasCtx.strokeRect(box.x, box.y, box.width, box.height)
    const padding = 50
    faceCanvasCtx.drawImage(canvasDiv, box.x - padding, box.y - padding, box.width + (padding * 2), box.height + (padding * 2), 0, 0, faceCanvasDiv.width, faceCanvasDiv.height)
    // __binarization(faceCanvasCtx)
    // __greyScale(faceCanvasCtx)
    // faceCanvasに表示されている顔でもう一度顔認識
    const options = {
      detectionsEnabled: true,
      landmarksEnabled: true,
      descriptorsEnabled: false,
      expressionsEnabled: false
    }
    const detectionsDetail = await dispatch('getFaceDetections', { canvas: faceCanvasDiv, options })
    if (!detectionsDetail.length) { return }
    const detectionDetail = detectionsDetail[0]
    // 目のlandmarksとEARを描画
    const __leftEyePoints = detectionDetail.landmarks.getLeftEye()
    const __rightEyePoints = detectionDetail.landmarks.getRightEye()
    const leftEAR = __eyeAspectRatio(__leftEyePoints)
    const rightEAR = __eyeAspectRatio(__rightEyePoints)
    faceCanvasCtx.fillStyle = 'red'
    faceCanvasCtx.font = state.detections.fontSize + 'px ' + state.detections.fontStyle
    __drawEyes(faceCanvasCtx, __leftEyePoints, __rightEyePoints, leftEAR, rightEAR)
    return { leftEAR, rightEAR }
  },
  drawEyesBinary ({ commit, state, dispatch }, { canvasDiv, canvasCtx, leftCanvasDiv, leftCanvasCtx, rightCanvasDiv, rightCanvasCtx, detection, binaryThreshold }) {
    // canvasの顔のところだけ切り抜いてfaceCanvasに書き込み
    if (!detection.landmarks) { return }
    const box = detection.detection.box
    canvasCtx.strokeRect(box.x, box.y, box.width, box.height)
    const padding = 2
    const l = minmax(detection.landmarks.getLeftEye(), 999, 999)
    leftCanvasCtx.drawImage(
      canvasDiv,
      l.xmin - padding,
      l.ymin - padding,
      l.xmax - l.xmin + (padding * 2),
      l.ymax - l.ymin + (padding * 2),
      0, 0, leftCanvasDiv.width, leftCanvasDiv.height)
    __drawNumber(canvasCtx, [{ x: l.xmin, y: l.ymin }, { x: l.xmax, y: l.ymax }])
    __binarization(leftCanvasCtx, leftCanvasDiv, binaryThreshold)
    const r = minmax(detection.landmarks.getRightEye(), 999, 999)
    rightCanvasCtx.drawImage(
      canvasDiv,
      r.xmin - padding,
      r.ymin - padding,
      r.xmax - r.xmin + (padding * 2),
      r.ymax - r.ymin + (padding * 2),
      0, 0, rightCanvasDiv.width, rightCanvasDiv.height)
    __drawNumber(canvasCtx, [{ x: r.xmin, y: r.ymin }, { x: r.xmax, y: r.ymax }])
    __binarization(rightCanvasCtx, leftCanvasDiv, binaryThreshold)
    const leftBlackRate = __getBlackPixelRate(leftCanvasCtx, leftCanvasDiv)
    const rightBlackRate = __getBlackPixelRate(rightCanvasCtx, rightCanvasDiv)
    return { leftBlackRate, rightBlackRate }
  },
  async createCanvas ({ commit, state }, elementId) {
    const canvas = await faceapi.createCanvasFromMedia(document.getElementById(elementId))
    return canvas
  }
}

const minmax = (points, xlimit, ylimit) => {
  let xmax = 0; let xmin = xlimit; let ymax = 0; let ymin = ylimit
  for (const point of points) {
    xmax = xmax < point.x ? point.x : xmax
    xmin = xmin > point.x ? point.x : xmin
    ymax = ymax < point.y ? point.y : ymax
    ymin = ymin > point.y ? point.y : ymin
  }
  return { xmax, xmin, ymax, ymin }
}

const __drawEyes = (canvasCtx, leftPoints, rightPoints, leftEAR, rightEAR) => {
  __drawNumber(canvasCtx, leftPoints)
  __drawNumber(canvasCtx, rightPoints)
  canvasCtx.fillText(`
  left EAR: ${leftEAR}
  `, 20, 20)
  canvasCtx.fillText(`
  left EAR: ${rightEAR}
  `, 20, 50)
}

const __eyeAspectRatio = (points) => {
  return ((__norm(points[5], points[1]) + __norm(points[4], points[2]))) / (2 * (__norm(points[0], points[3])))
}

const __norm = (p1, p2) => {
  return Math.sqrt(((p1.x - p2.x) ** 2) + ((p1.y - p2.y) ** 2))
}

const __drawNumber = (canvasCtx, points) => {
  points.forEach((point, i) => {
    canvasCtx.fillText(i, point.x, point.y)
  })
}

const __greyScale = (ctx) => {
  const imageData = ctx.getImageData(0, 0, 500, 500)
  const d = imageData.data
  for (let i = 0; i < d.length; i += 4) {
    const g = d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722
    d[i] = d[i + 1] = d[i + 2] = g
  }
  ctx.putImageData(imageData, 0, 0)
}

const __binarization = (ctx, div, threshold = 40) => {
  const src = ctx.getImageData(0, 0, div.width, div.height)
  const dst = ctx.createImageData(div.width, div.height)
  for (let i = 0; i < src.data.length; i = i + 4) {
    const y = ~~(0.299 * src.data[i] + 0.587 * src.data[i + 1] + 0.114 * src.data[i + 2])
    const ret = (y > threshold) ? 255 : 0
    dst.data[i] = dst.data[i + 1] = dst.data[i + 2] = ret
    dst.data[i + 3] = src.data[i + 3]
  }
  ctx.putImageData(dst, 0, 0)
}

const __getBlackPixelRate = (ctx, div) => {
  const imageData = ctx.getImageData(0, 0, div.width, div.height)
  const blackCount = imageData.data.filter(i => i === 0).length
  return blackCount / imageData.data.length
}
