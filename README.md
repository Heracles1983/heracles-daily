# HERACLES DAILY

移动端优先的每日恢复与训练准备度规则引擎。粘贴 HRV、睡眠、静息心率、ATL/CTL 与训练记录后，网页会在当前浏览器内计算三项准备度，并给出唯一主要训练方案。

这是纯前端静态应用：不调用 AI，不上传训练数据，不需要账号、数据库或服务器密钥。

## 开源协议

本项目采用 MIT License。你可以学习、修改、分发和二次开发，但训练建议仅供一般信息与自我管理参考，不构成医疗诊断。

## 已实现

- Recovery = HRV 40% + Sleep 35% + RHR 25%
- Readiness = Recovery 50% + Load 30% + Structure 20%
- 首页三项核心评分：Recovery / Strength Readiness / Aerobic Readiness
- 第一屏只保留三项准备度、今日建议、首选项目与关键限制
- Key Limiter 自动提取当天最重要限制因素
- Form、ACWR、ATL Spike、Fatigue Momentum 自动计算
- Neural Limited / CNS Fatigue、疼痛和急性症状硬性封顶
- 缺失值显示 Unknown，剩余可用权重自动归一化
- 支持整段粘贴 HERACLES DAILY 报告并自动识别填表
- 粘贴后显示“已识别字段 / 缺失字段”，不再静默失败
- 粘贴后可在 30 秒内补充疼痛、症状、精神状态与局部酸痛
- 推荐训练、RPE、时长、动作、组次与重量集中在同一方案板块
- 同部位力量刺激 48 小时内不重复推荐
- 腿部力量与高强度骑行互相执行 36 小时交叉冷却
- 手动输入与计算审计默认折叠，需要时再展开
- 数据仅保存在当前设备浏览器
- 一键导出 1080×1920 今日报告图片，内容与网页三项准备度逻辑一致
- 骑行、力量、游泳、拳击分别输出对应训练细案
- 支持安装到 iPhone / iPad 主屏幕

## 在 iPad 上发布到 GitHub Pages

1. 在 GitHub 新建公开仓库，建议命名为 `heracles-daily`。
2. 把本项目全部文件上传到仓库根目录。
3. 打开仓库的 `Settings → Pages`。
4. 在 `Build and deployment` 中选择 `GitHub Actions`。
5. 等待仓库上方 `Actions` 页面显示绿色完成标记。
6. 回到 `Settings → Pages`，打开生成的网址。
7. 在 Safari 分享菜单选择“添加到主屏幕”。

之后每次修改并提交代码，GitHub 会自动重新发布。

## 本地开发

```bash
npm install
npm run dev
```

生产构建输出在 `dist/client`，可直接交给 GitHub Pages 或任意静态托管服务。
