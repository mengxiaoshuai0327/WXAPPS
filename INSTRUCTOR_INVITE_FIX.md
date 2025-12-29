# 授课人邀请码匹配修复文档

## 问题描述

用户注册时输入授课人ID（如 `140866389`），但系统无法识别邀请人信息并派发优惠券。

## 根本原因

数据库中的 `instructor_id` 格式是 `I` + 8位数字（如 `I140866389`），但用户注册时可能只输入了数字部分（如 `140866389`，不带 `I` 前缀），导致查询失败。

## 修复方案

### 1. 支持两种格式的授课人ID

**修复前**：
- 只能匹配完整的 `instructor_id`（如 `I140866389`）

**修复后**：
- 支持完整格式：`I140866389`
- 支持纯数字格式：`140866389`（自动添加 `I` 前缀）

### 2. 匹配逻辑

1. **第一步**：使用原邀请码匹配（如果输入的是 `I140866389`，可以直接匹配）
2. **第二步**：如果未找到且邀请码是纯数字，自动添加 `I` 前缀再匹配（`140866389` → `I140866389`）

### 3. 代码位置

`backend/routes/auth.js` 第388-422行

## 测试验证

### 测试用例1：使用完整格式的授课人ID

**输入**：`I140866389`
**预期**：能正确匹配到授课人，发放优惠券

### 测试用例2：使用纯数字格式的授课人ID

**输入**：`140866389`
**预期**：自动转换为 `I140866389` 后匹配，能正确匹配到授课人，发放优惠券

### 测试用例3：无效的授课人ID

**输入**：`I99999999` 或 `99999999`
**预期**：匹配失败，继续尝试渠道方匹配（如果也未找到，则不建立邀请关系）

## 数据库查询示例

```sql
-- 检查授课人记录
SELECT id, member_id, instructor_id, role, nickname, real_name 
FROM users 
WHERE instructor_id IN ('I140866389', '140866389') 
  AND role = 'instructor';

-- 检查是否存在 instructor_id = 'I140866389' 的授课人
SELECT id, instructor_id, real_name 
FROM users 
WHERE instructor_id = 'I140866389' 
  AND role = 'instructor';
```

## 日志输出

修复后，服务器日志会显示：

```
[注册] 开始匹配邀请码: 140866389
[注册] 通过member_id未找到匹配: 140866389
[注册] 邀请码是纯数字，尝试匹配instructor_id: I140866389
[注册] 使用原邀请码未找到授课人，尝试使用格式化的instructor_id: I140866389
[注册] 找到授课人: instructor_id=I140866389, name=张三
找到邀请人: ID=xxx, instructor_id=I140866389, role=instructor, 邀请码=140866389
[授课人推广] 设置推广信息: promotion_type=instructor, instructor_id=I140866389, instructor_name=张三
[授课人优惠券发放] 开始处理授课人邀请，inviter_id=xxx, inviter_role=instructor, promotion_type=instructor
✓ 已为被邀请人 xxx 发放授课人推广优惠券：金额¥xxx，有效期xxx天
```

## 相关字段说明

- `instructor_id` 格式：`I` + 8位数字
- `instructor_id` 在 `users` 表中是唯一字段（UNIQUE）
- 只有 `role='instructor'` 的用户才会有 `instructor_id`

