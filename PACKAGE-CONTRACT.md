# 河豚主题与基础 APK 固定接口 v1

此文档描述本地已实现的协议。主题作者不管理证书和构建环境；打包器不编辑主题 UI；客户端开发者实现原生渲染能力。

## 数据责任

| 内容 | 唯一负责方 |
|---|---|
| 主题布局、颜色、图片、主题 ZIP | 主题中心 |
| 主题渲染、设备输入、原生功能、权限 | 原生客户端源码 |
| 基础 APK、版本、后台地址、JKS、签名成品 | 打包器 |
| CMS 数据、会员、收费、播放鉴权和解析 | 独立业务后台 |

主题 ZIP 使用 hetun-skeleton v2，manifest.json 中包含 theme、platform、id、name；素材使用 assets/ 下的本地相对路径。packaging 字段提供需求摘要，但打包器必须重新遍历 theme 检查。导出剥离旧 integration 后台配置，主题包不能覆盖打包器后台地址或签名。

## 基础 APK

assets/hetun-base.json 必须声明：format=hetun-base-apk、version=1、contract=hetun-package-v1、runtime=hetun-runtime-v1、theme=hetun-skeleton-v2、os=android、assetRoot=assets/、packageName、devices、renderer、themeFields；可选 themeValues 声明字段允许的枚举。

实际字段声明示例（不是自动适配承诺）：brand.name、colors.background、navigation、navigation[].label、navigation[].page。数组容器与子字段分别检查，不允许通配符。完整已实现能力见打包器 native/android/theme-capabilities.json。新增字段必须先实现原生行为再声明。

基础 APK 必须有二进制 AndroidManifest.xml 和 DEX，实际包名与协议声明一致，应用 label 和版本为可修改的字面量。基础包被修改必须重新导入。版本构建号不得低于基础包。

成品保留基础包原生代码与资源，写入 assets/manifest.json、assets/assets/ 中的主题素材、assets/runtime.json。runtime 使用 hetun-runtime-v1，包含设备、平台、包名、名称、版本和 apiBase；不包含私钥、签名密码或用户登录令牌。

必须用自己的 JKS 对最终 APK 签名。升级已安装应用时需保持相同包名与签名证书；更换签名通常不能覆盖原安装。

## 两软件手动交接

两个软件为独立个体，不共享运行状态、心跳、基础包能力、目录发布或主题队列。主题中心只保存本机草稿和导出主题包，不提供本机发布或成品主题读取服务；导出的主题 ZIP 由用户在打包器手动导入，打包器自行检查实际基础包能力。

旧 GET/POST /api/admin/local-packer 已停用，返回 HTTP410 和 INDEPENDENT_APPS。打包器不暴露 localReceive、localLink、themeSync 入口。原有主题、应用配置与历史共享目录保留，不删除存量数据。

## 验收范围

Android 链路验证包括：真实基础 APK 编译，脱离源码和 Gradle 的主题注入、对齐、JKS 签名、apksigner 校验、aapt 身份检查、原生文件与资产完整性检查。自动化测试不替代真机界面、遥控器、真实 CMS 和播放验证。

当前 Kotlin 核心渲染器能力小于主题编辑器完整功能集，完整默认主题会报告缺失字段，不能标为全部适配。iOS/Windows 共享数据协议可以复用，但二进制重打包尚未实现，不允许据目标列表显示为可用。
