import axios from 'axios';

const api = axios.create({
  baseURL: process.env.VUE_APP_API_BASE_URL || '/api',
  timeout: 10000
});

// 请求拦截器
api.interceptors.request.use(
  config => {
    // 可以在这里添加token等
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  response => {
    return response.data;
  },
  error => {
    console.error('API错误:', error);
    // 确保错误信息能正确传递
    if (error.response && error.response.data) {
      // 将错误信息附加到 error 对象上，方便组件访问
      error.error = error.response.data.error;
      error.message = error.response.data.message || error.response.data.error;
    }
    return Promise.reject(error);
  }
);

export default api;

