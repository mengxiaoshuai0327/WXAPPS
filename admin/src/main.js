import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';

// 全局抑制 ResizeObserver 错误（这是浏览器的一个已知问题，不影响功能）
if (typeof window !== 'undefined') {
  // 在最早的时候抑制错误，防止 webpack-dev-server overlay 显示
  const originalError = console.error;
  const originalWarn = console.warn;
  
  console.error = (...args) => {
    const errorMessage = String(args[0] || '');
    if (errorMessage.includes('ResizeObserver loop') || 
        errorMessage.includes('ResizeObserver loop completed') ||
        errorMessage.includes('ResizeObserver loop limit exceeded')) {
      return;
    }
    originalError.apply(console, args);
  };

  console.warn = (...args) => {
    const warnMessage = String(args[0] || '');
    if (warnMessage.includes('ResizeObserver loop') || 
        warnMessage.includes('ResizeObserver loop completed') ||
        warnMessage.includes('ResizeObserver loop limit exceeded')) {
      return;
    }
    originalWarn.apply(console, args);
  };

  // 抑制全局错误事件（在捕获阶段）
  window.addEventListener('error', (event) => {
    const errorMessage = event.message || event.error?.message || '';
    if (errorMessage.includes('ResizeObserver loop') ||
        errorMessage.includes('ResizeObserver loop completed') ||
        errorMessage.includes('ResizeObserver loop limit exceeded')) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return false;
    }
  }, true);

  // 抑制未捕获的 Promise 错误
  window.addEventListener('unhandledrejection', (event) => {
    const errorMessage = event.reason?.message || String(event.reason || '');
    if (errorMessage.includes('ResizeObserver loop') ||
        errorMessage.includes('ResizeObserver loop completed') ||
        errorMessage.includes('ResizeObserver loop limit exceeded')) {
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
  }, true);
}

const app = createApp(App);

// 注册所有图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}

app.use(router);
app.use(ElementPlus);
app.mount('#app');

