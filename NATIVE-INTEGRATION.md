# 河豚主题中心与原生客户端接入

当前固定协议以 [PACKAGE-CONTRACT.md](./PACKAGE-CONTRACT.md) 为准。主题中心只制作、保存、预览并导出主题；原生客户端实现主题渲染；打包器导入基础 APK 和主题，写入运行配置并签名。

## 主题交接

主题 ZIP 使用 hetun-skeleton v2，包含 manifest.json 与 assets/ 本机素材。导出会剥离旧 integration 配置；后台地址只在打包器填写。旧包可回导，但不能通过旧字段覆盖打包器的运行配置。clientContract 是平台与业务数据契约，不能证明基础 APK 已实现主题效果。

主题中心通过本机心跳发现打包器，读取当前应用所选基础 APK 的能力。多端接入面板提供真实兼容检查和发送：检查会导出已保存的当前主题并逐字段校验；发送会写入交接队列，接收回执和兼容结果独立显示。已连接并不表示当前主题全部兼容。端口动态分配，本机会话、Origin 与请求头校验保留。

## 原生接入要求

Android 基础 APK 必须实现 hetun-package-v1，提供 assets/hetun-base.json、原生 DEX 和二进制 Manifest。声明的设备、字段和枚举必须有真实原生实现。当前打包器 Kotlin 核心渲染器覆盖范围小于完整编辑器，缺失效果会明确拒绝打包。不能把任意第三方 APK 当成已适配底包。

运行时读取 assets/runtime.json、assets/manifest.json 和 assets/assets/ 主题素材。统一业务协议定义在 shared-source/server/native-api.openapi.json；业务后台负责将苹果 CMS（MacCMS）数据、会员与播放转换为此协议。苹果 CMS 是内容系统，iOS 是客户端平台。主题编辑器不负责 CMS 登录、播放鉴权或解析。

iOS、Android、TV 可复用主题数据格式和业务字段，但各端仍需实现自己的渲染器。当前真实二进制重打包仅支持协议 Android APK；IPA/EXE 重打包和真机业务联调尚未完成。

## 版本规则

破坏性协议修改必须升级版本。主题导出的需求摘要不受信任，打包器重新遍历实际主题并检查；本机能力过期或基础包发生变化时不能继续沿用旧兼容结果。签名凭据只由打包器的本机安全存储管理。
