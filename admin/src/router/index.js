import { createRouter, createWebHistory } from 'vue-router';
import Layout from '../layout/Layout.vue';

const routes = [
  {
    path: '/dashboard',
    redirect: '/courses/list'
  },
  {
    path: '/',
    component: Layout,
    redirect: '/courses/list',
    children: [
      {
        path: 'courses/modules',
        name: 'CourseModules',
        component: () => import('../views/courses/Modules.vue'),
        meta: { title: '课程模块' }
      },
      {
        path: 'courses/themes',
        name: 'CourseThemes',
        component: () => import('../views/courses/Themes.vue'),
        meta: { title: '课程主题' }
      },
      {
        path: 'courses/list',
        name: 'CourseList',
        component: () => import('../views/courses/List.vue'),
        meta: { title: '课程列表' }
      },
      {
        path: 'courses/schedules',
        name: 'CourseSchedules',
        component: () => import('../views/courses/Schedules.vue'),
        meta: { title: '排课列表' }
      },
      {
        path: 'users/list',
        name: 'UserList',
        component: () => import('../views/users/List.vue'),
        meta: { title: '用户列表' }
      },
      {
        path: 'users/instructors',
        name: 'Instructors',
        component: () => import('../views/users/Instructors.vue'),
        meta: { title: '教练列表' }
      },
      {
        path: 'users/channels',
        name: 'Channels',
        component: () => import('../views/users/Channels.vue'),
        meta: { title: '渠道方列表' }
      },
      {
        path: 'users/channel-sales',
        name: 'ChannelSales',
        component: () => import('../views/users/ChannelSales.vue'),
        meta: { title: '渠道销售列表' }
      },
      {
        path: 'tickets/list',
        name: 'TicketList',
        component: () => import('../views/tickets/List.vue'),
        meta: { title: '课券列表' }
      },
      {
        path: 'tickets/gifts',
        name: 'TicketGifts',
        component: () => import('../views/tickets/Gifts.vue'),
        meta: { title: '赠券列表' }
      },
      {
        path: 'discounts/list',
        name: 'DiscountList',
        component: () => import('../views/discounts/List.vue'),
        meta: { title: '优惠券使用列表' }
      },
      {
        path: 'evaluations/list',
        name: 'EvaluationList',
        component: () => import('../views/evaluations/List.vue'),
        meta: { title: '评价管理' }
      },
      {
        path: 'evaluations/statistics',
        name: 'EvaluationStatistics',
        component: () => import('../views/evaluations/Statistics.vue'),
        meta: { title: '课程评价统计' }
      },
      {
        path: 'evaluations/pending-list',
        name: 'EvaluationPendingList',
        component: () => import('../views/evaluations/PendingList.vue'),
        meta: { title: '待评价列表' }
      },
      {
        path: 'rankings',
        name: 'Rankings',
        component: () => import('../views/rankings/Index.vue'),
        meta: { title: '排行榜管理' }
      },
      {
        path: 'messages',
        name: 'Messages',
        component: () => import('../views/messages/Index.vue'),
        meta: { title: '消息管理' }
      },
      {
        path: 'invitations/list',
        name: 'InvitationList',
        component: () => import('../views/invitations/List.vue'),
        meta: { title: '邀请管理' }
      },
      {
        path: 'banners/list',
        name: 'BannerList',
        component: () => import('../views/banners/List.vue'),
        meta: { title: 'Banner管理' }
      },
      {
        path: 'posters/list',
        name: 'PosterList',
        component: () => import('../views/posters/List.vue'),
        meta: { title: '邀请海报管理' }
      },
      {
        path: 'marketing/member-promotion',
        name: 'MemberPromotion',
        component: () => import('../views/marketing/MemberPromotion.vue'),
        meta: { title: '会员邀请方案管理' }
      },
      {
        path: 'marketing/instructor-promotion',
        name: 'InstructorPromotion',
        component: () => import('../views/marketing/InstructorPromotion.vue'),
        meta: { title: '教练推广方案管理' }
      },
      {
        path: 'marketing/channel-promotion-schemes',
        name: 'ChannelPromotionSchemes',
        component: () => import('../views/marketing/ChannelPromotionSchemes.vue'),
        meta: { title: '渠道推广方案管理' }
      },
      {
        path: 'marketing/admin-special',
        name: 'AdminSpecial',
        component: () => import('../views/marketing/AdminSpecial.vue'),
        meta: { title: '特殊推广方案管理' }
      },
      {
        path: 'bookings',
        name: 'Bookings',
        component: () => import('../views/bookings/List.vue'),
        meta: { title: '课程预定列表' }
      },
      {
        path: 'invoices/list',
        name: 'InvoiceList',
        component: () => import('../views/invoices/List.vue'),
        meta: { title: '发票管理列表' }
      },
      {
        path: 'intentions/list',
        name: 'IntentionList',
        component: () => import('../views/intentions/List.vue'),
        meta: { title: '课程意向列表' }
      },
      {
        path: 'protocols',
        name: 'Protocols',
        component: () => import('../views/protocols/Index.vue'),
        meta: { title: '协议管理' }
      }
    ]
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue')
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;

