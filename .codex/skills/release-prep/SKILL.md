---
name: release-prep
description: 准备 VS Code 扩展预发版或发布版本，完成版本号、CHANGELOG、README 检查和发布前验证。当用户要求预发版准备、release prep、准备发布或整理发布前改动时使用此技能。
---

# Release Prep

此 Skill 用于准备新版本发布，不负责实际发布、打包或提交，除非用户明确要求。

## 使用场景

当用户提出以下需求时使用：

- 准备预发版或正式发布
- 执行 release prep / 发布准备
- 根据当前分支改动更新版本号和更新日志
- 发布前检查 README、CHANGELOG 和验证命令

## 工作流程

1. 检查当前分支状态，确认已有改动范围
2. 对比 `master...HEAD` 的文件变化和提交记录，判断本次发布内容
3. 根据变更性质决定 semver 版本号：
   - `patch`：仅缺陷修复、文案或小体验优化
   - `minor`：新增用户可见功能或明显体验升级
   - `major`：破坏性变更
4. 更新 `package.json` 的 `version`
5. 如果 `package-lock.json` 已被 Git 跟踪，同步其中的版本号；如果未跟踪，只在最终结果中说明
6. 更新 `CHANGELOG.md`：
   - 新版本条目放在顶部
   - 可以保留 `feat:`、`fix:`、`docs:`、`refactor:` 等前缀
   - 正文必须面向用户描述
   - 不写接口、RPC、模块拆分、状态同步、构建配置、类型声明等开发性说明
   - 不逐条照搬提交信息，按用户可感知能力和体验变化聚合
7. 检查 `README.md` 是否需要同步：
   - 新增用户可见功能时，更新功能列表
   - 设置项描述变化时，同步设置说明
   - 只做必要的小幅更新，避免重写 README
8. 按项目规范格式化所有改动文件：

   ```bash
   npm run format -- <changed-files>
   ```

9. 运行发布前验证：

   ```bash
   npm run check
   npm test
   npm run build
   ```

10. 最终回复中汇总：
    - 新版本号
    - 修改的文件
    - README 是否更新及原因
    - 已执行的验证命令和结果

## 约束

- 不自动发布、不自动打包、不自动提交，除非用户明确要求
- 不回滚用户已有改动
- 如果 `package-lock.json` 未被 Git 跟踪，不要强行加入版本控制
- CHANGELOG 面向扩展用户，不面向开发者
- 涉及后端接口、V2EX 返回字段或 HTML 解析变化时，先核对现有类型、解析器、测试夹具和实际调用路径
