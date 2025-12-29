# 二维码邀请码自动填入功能说明

## 功能概述

当用户扫描三种角色（会员、渠道销售、授课人）的邀请二维码时，邀请码会自动填入注册页面的邀请码输入框。

## 实现机制

### 1. 二维码生成

后端API (`/api/invitations/qrcode/:inviteCode`) 生成二维码时，会将邀请码包含在小程序路径中：

```javascript
// 格式：pages/register/register?invite_code=XXX
const miniProgramPath = `pages/register/register?invite_code=${inviteCode}`;
```

### 2. 三种角色的二维码生成

#### 授课人二维码
- **页面**：`pages/promotion/promotion.js`
- **邀请码**：使用 `instructor_id`（如 `I73084993`）
- **二维码URL**：`/api/invitations/qrcode/${instructor_id}`

#### 渠道销售二维码
- **页面**：`pages/promotion/promotion.js`
- **邀请码**：使用 `member_id`（如 `M98677504`）
- **二维码URL**：`/api/invitations/qrcode/${member_id}`

#### 普通会员二维码
- **页面**：`pages/invitation/invitation.js`
- **邀请码**：使用 `member_id`（如 `M12345678`）
- **二维码URL**：`/api/invitations/qrcode/${member_id}`

### 3. 注册页面自动填入

注册页面 (`pages/register/register.js`) 的 `onLoad` 方法会从URL参数中获取邀请码：

```javascript
onLoad(options) {
  // 如果有邀请码，自动填入
  if (options.invite_code) {
    this.setData({ inviteCode: options.invite_code });
  }
}
```

### 4. 邀请码匹配逻辑

后端注册逻辑 (`backend/routes/auth.js`) 支持三种格式的邀请码查找：

1. **数据库ID**（纯数字，如 `108`）
   - 先尝试作为数据库ID查找

2. **member_id**（格式：`M12345678`）
   - 如果数据库ID查找失败，尝试作为member_id查找
   - 支持会员和渠道销售

3. **instructor_id**（格式：`I73084993`）
   - 如果member_id查找失败，尝试作为instructor_id查找
   - 支持授课人

## 使用流程

1. **生成二维码**：
   - 授课人/渠道销售在"推广专区"页面查看二维码
   - 普通会员在"我的邀请"页面查看二维码

2. **扫描二维码**：
   - 用户使用微信扫描二维码
   - 自动跳转到注册页面：`pages/register/register?invite_code=XXX`

3. **自动填入**：
   - 注册页面的 `onLoad` 方法自动从URL参数中获取 `invite_code`
   - 邀请码自动填入到输入框

4. **注册**：
   - 用户可以修改邀请码（如果需要）
   - 提交注册时，后端会根据邀请码查找对应的邀请人
   - 根据邀请人角色（会员/渠道销售/授课人）发放相应的优惠券

## 注意事项

1. 二维码URL格式必须正确：`pages/register/register?invite_code=XXX`
2. 邀请码参数名必须是 `invite_code`（下划线）
3. 后端注册逻辑已经支持三种格式的邀请码查找，包括重试机制
4. 普通会员、渠道销售和授课人的二维码生成逻辑已经分别实现

## 测试验证

要测试二维码功能：
1. 在推广专区或邀请页面查看二维码
2. 使用微信扫一扫扫描二维码
3. 确认注册页面的邀请码输入框已自动填入
4. 提交注册，确认能够正确识别邀请人并发放优惠券

