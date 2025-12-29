module.exports = {
  devServer: {
    port: 8080,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    },
    client: {
      overlay: {
        errors: true,
        warnings: false,
        runtimeErrors: (error) => {
          // 忽略 ResizeObserver 错误，防止 webpack-dev-server overlay 显示
          const errorMessage = error.message || error.toString() || '';
          if (errorMessage.includes('ResizeObserver loop') ||
              errorMessage.includes('ResizeObserver loop completed') ||
              errorMessage.includes('ResizeObserver loop limit exceeded')) {
            return false;
          }
          return true;
        }
      }
    }
  }
};

