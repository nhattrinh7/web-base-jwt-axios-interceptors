import axios from 'axios'
import { toast } from 'react-toastify'
import { handleLogoutAPI, refreshTokenAPI } from '~/apis'

// Khởi tạo 1 đối tượng axios để custom và cấu hình chung cho dự án, dùng để gọi API ở mọi nơi trong dự án

let authorizedAxiosInstance = axios.create()
// Thời gian chờ tối đa của 1 request: để 10 phút, bắt trường hợp backend trả về dữ liệu quá lâu
authorizedAxiosInstance.defaults.timeout = 1000 * 60 * 10

// withCredentials: cho phép axios tự động đính kèm + gửi cookie trong mỗi request (header của request) lên BE (phục vụ trường hợp nếu chúng ta lưu
// acess & refresh token vào Cookie theo cơ chế httpOnly Cookie)
authorizedAxiosInstance.defaults.withCredentials = true

// *** Cấu hình Interceptor (ở giữa request và response) ***

// Add a request interceptor: can thiệp vào giữa các request API
authorizedAxiosInstance.interceptors.request.use(config => {
  // Do something before request is sent: lấy accessToken từ localStorage đính vào header của request
  const accessToken = localStorage.getItem('accessToken')
  if (accessToken) {
    // cần thêm 'Bearer' vì đó là từ khóa chuẩn theo OAuth 2.0 xác định token đang sử dụng là token xác thực và ủy quyền
    // có các loại khác như: Basic, Digest, OAuth,...
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
}, function (error) {
  // Do something with request error
  return Promise.reject(error)
})

/**
 * Khởi tạo 1 cái Promise cho việc gọi API refresh_token
   Mục đích tạo Promise này để khi nhận yêu cầu refreshToken đầu tiên thì hold lại việc gọi API refresh_token cho tới khi
   xong xuôi thì mới retry lại những api bị lỗi trước đó thay vì gọi refreshTokenAPI liên tục với mỗi request lỗi, vì thế sẽ chỉ cần gọi refresh_token 1 lần
*/
let refreshTokenPromise = null


// Add a response interceptor: cap thiệp vào giữa các response nhận về từ API
authorizedAxiosInstance.interceptors.response.use(response => {
  // bất cứ mã 2xx nào cũng sẽ kích hoạt chức năng này
  // Do something with response data
  return response
}, (error) => {

  // *** Xử lí Refresh Token tự động ***
  // Nếu nhận 401 từ BE thì gọi api logout luôn
  if (error.response.status === 401) {
    handleLogoutAPI()
      .then(() => {
        // Nếu dùng cookie thì nhớ xóa userInfo trong LocalStorage ở đây, chả qua đang dùng cả LocalStorage nên trong API có xóa rồi
        // localStorage.removeItem('userInfo')
        // Điều hướng dùng JS thuần
        location.href = '/login'
      })
  }
  // Nếu nhận 410 sẽ gọi API Refresh token để làm mới accessToken
  // 1. Đầu tiên lấy các request API đang bị lỗi thông qua error.config
  const originalRequest = error.config

  //
  if (error.response.status === 410 && !originalRequest) {

    if (!refreshTokenPromise) {
      // Lấy refreshToken từ Localstorage - trường hợp Localstorage
      const refreshToken = localStorage.getItem('refreshToken')

      // Gọi API refreshToken
      refreshTokenPromise = refreshTokenAPI(refreshToken)
        .then((res) => {
          // Lấy và gán lại accessToke vào Localstorage (trường hợp Localstorage)
          const { accessToken } = res.data
          localStorage.setItem('accessToken', accessToken)
          authorizedAxiosInstance.defaults.headers.Authorization = `Bearer ${accessToken}` // lúc này thì lại gán qua authorizedAxiosInstance chứ ko phải config

          // *** Đồng thời lưu ý là accessToken đã được update lại ở Cookie rồi - trường hợp Cookie ***

        })
        .catch((_error) => {
          // refreshToken bị lỗi thì cho Logout luôn
          handleLogoutAPI()
            .then(() => {
              // Nếu dùng cookie thì nhớ xóa userInfo trong LocalStorage ở đây, chả qua đang dùng cả LocalStorage nên trong API có xóa rồi
              // localStorage.removeItem('userInfo')
              // console.log('vào catch _error')
              location.href = '/login'
            })

          return Promise.reject(_error)
        })
        .finally (() => {
          refreshTokenPromise = null // Thành công hay lỗi cũng gán về null
        })
    }

    // Đây mới là bước cuối mà ta sẽ chạy lại các cái request bị lỗi sau khi cái bên trên chạy (hold lại) thành công
    return refreshTokenPromise.then(() => {
      // Bước cuối - QUAN TRỌNG: return lại axios instance kết hợp originalRequest để gọi lại API sau khi đã có accessToken mới
      return authorizedAxiosInstance(originalRequest)
    })
  }

  // Dùng toastify để hiển thị bất kể mọi mã lỗi lên màn hình - ngoại trừ mã 410 - GONE: phục vụ việc tự động refresh lại token
  // dùng mã 410 khi accessToken hết hạn, trả 410 về đây để Interceptor biết cần gọi API refreshToken tự động lại
  if (error.response.status !== 410) {
    toast.error(error.response?.data?.message || error?.message)
  }
  return Promise.reject(error)
  // tạo ra một Promise bị từ chối (rejected) với lỗi error. Điều này cho phép lỗi được bắt lại ở .catch() của lời gọi axios.
})

export default authorizedAxiosInstance
