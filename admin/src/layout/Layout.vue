<template>
  <el-container class="layout-container">
    <el-aside width="200px" class="sidebar">
      <div class="logo">CFO高手私教小班课</div>
      <el-menu
        :default-active="activeMenu"
        router
        class="sidebar-menu"
        background-color="#1a1a1a"
        text-color="#fff"
        active-text-color="#ffd04b"
      >
        <el-sub-menu index="courses">
          <template #title>
            <el-icon><Reading /></el-icon>
            <span>课程管理</span>
          </template>
          <el-menu-item index="/courses/modules">模块列表</el-menu-item>
          <el-menu-item index="/courses/themes">主题列表</el-menu-item>
          <el-menu-item index="/courses/list">课程列表</el-menu-item>
          <el-menu-item index="/courses/schedules">排课列表</el-menu-item>
          <el-menu-item index="/bookings">课程预定列表</el-menu-item>
          <el-menu-item index="/intentions/list">课程意向列表</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="users">
          <template #title>
            <el-icon><User /></el-icon>
            <span>用户管理</span>
          </template>
          <el-menu-item index="/users/list">用户列表</el-menu-item>
          <el-menu-item index="/users/instructors">教练列表</el-menu-item>
          <el-menu-item index="/users/channels">渠道方列表</el-menu-item>
          <el-menu-item index="/users/channel-sales">渠道销售列表</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="tickets">
          <template #title>
            <el-icon><Ticket /></el-icon>
            <span>课券管理</span>
          </template>
          <el-menu-item index="/tickets/list">课券列表</el-menu-item>
          <el-menu-item index="/tickets/gifts">赠券列表</el-menu-item>
          <el-menu-item index="/discounts/list">优惠券列表</el-menu-item>
          <el-menu-item index="/invoices/list">发票管理列表</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="evaluations">
          <template #title>
            <el-icon><ChatLineRound /></el-icon>
            <span>评价管理</span>
          </template>
          <el-menu-item index="/evaluations/list">评价列表</el-menu-item>
          <el-menu-item index="/evaluations/statistics">评价统计</el-menu-item>
          <el-menu-item index="/evaluations/pending-list">待评价列表</el-menu-item>
        </el-sub-menu>

        <el-menu-item index="/rankings">
          <el-icon><Trophy /></el-icon>
          <span>排行榜管理</span>
        </el-menu-item>

        <el-menu-item index="/messages">
          <el-icon><Message /></el-icon>
          <span>消息管理</span>
        </el-menu-item>

        <el-menu-item index="/banners/list">
          <el-icon><PictureRounded /></el-icon>
          <span>Banner管理</span>
        </el-menu-item>

        <el-menu-item index="/posters/list">
          <el-icon><PictureRounded /></el-icon>
          <span>邀请海报管理</span>
        </el-menu-item>

        <el-sub-menu index="marketing">
          <template #title>
            <el-icon><TrendCharts /></el-icon>
            <span>营销管理</span>
          </template>
          <el-menu-item index="/marketing/member-promotion">会员邀请方案管理</el-menu-item>
          <el-menu-item index="/marketing/instructor-promotion">教练推广方案管理</el-menu-item>
          <el-menu-item index="/marketing/channel-promotion-schemes">渠道推广方案管理</el-menu-item>
          <el-menu-item index="/marketing/admin-special">特殊推广方案管理</el-menu-item>
          <el-menu-item index="/discounts/list">优惠券使用列表</el-menu-item>
        </el-sub-menu>

        <el-menu-item index="/invitations/list">
          <el-icon><UserFilled /></el-icon>
          <span>邀请管理</span>
        </el-menu-item>

        <el-menu-item index="/protocols">
          <el-icon><Document /></el-icon>
          <span>协议管理</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="header">
        <div class="header-content">
          <h2>{{ pageTitle }}</h2>
        </div>
      </el-header>

      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { UserFilled, PictureRounded, Document } from '@element-plus/icons-vue';

export default {
  name: 'Layout',
  setup() {
    const route = useRoute();
    
    const activeMenu = computed(() => route.path);
    const pageTitle = computed(() => route.meta.title || '管理后台');

    return {
      activeMenu,
      pageTitle,
      UserFilled,
      PictureRounded,
      Document
    };
  }
};
</script>

<style scoped>
.layout-container {
  height: 100vh;
}

.sidebar {
  background-color: #1a1a1a;
  color: #fff;
}

.logo {
  height: 60px;
  line-height: 60px;
  text-align: center;
  font-size: 20px;
  font-weight: bold;
  color: #fff;
  background-color: #000;
}

.sidebar-menu {
  border-right: none;
}

.header {
  background-color: #fff;
  border-bottom: 1px solid #eee;
  display: flex;
  align-items: center;
  padding: 0 30px;
}

.header-content h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 500;
  color: #1a1a1a;
}

.main-content {
  padding: 30px;
  background-color: #f5f5f5;
}
</style>

