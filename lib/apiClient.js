import axios from 'axios'

const API_URL = 'https://tlmaqbsx9d.execute-api.ap-northeast-1.amazonaws.com/default/analyzeFace'

const uploadBase64 = async (base64) => {
  // const config = {
  //   headers: {
  //     'Content-Type': 'image/png'
  //   }
  // }
  const res = await axios.post(API_URL, base64)
  if (res.status !== 200) { throw new Error(JSON.stringify(res)) }
  return res
}
export default {
  uploadBase64,
}
