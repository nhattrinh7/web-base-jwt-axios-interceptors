import authorizedAxiosInstance from '~/utils/authorizedAxios'
import { API_ROOT } from '~/utils/constants'


export const handleLogoutAPI = async () => {
  // Trường hợp 1: dùng Local Storage, chỉ cần xóa thông tin user trong Local Storage phía FE
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('userInfo')

  // Trường hợp 2: dùng Http Only Cookies gọi API để xử lí remove Cookies
  return await authorizedAxiosInstance.delete(`${API_ROOT}/v1/users/logout`)
}

export const refreshTokenAPI = async (refreshToken) => {
  return await authorizedAxiosInstance.put(`${API_ROOT}/v1/users/refresh_token`, { refreshToken })
}