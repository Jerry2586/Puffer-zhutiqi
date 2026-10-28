# 河豚主题中心与原生客户端接入

当前固定协议以 [PACKAGE-CONTRACT.md](./PACKAGE-CONTRACT.md) 为准。主题中心只制作、保存、预览并导出主题；原生客户端实现主题渲染；打包器导入基础 APK 和主题，写入运行配置并签名。

## 主题交接

主题 ZIP 使用 hetun-skeleton v2，包含 manifest.json 与 assets/ 本机素材。导出会剥离旧 integration 配置；后台地址只在打包器填写。旧包可回导，但不能通过旧字段覆盖打包器的运行配置。clientContract 是平台与业务数据契约，不能证明基础 APK 已实现主题效果。

主题中心在“设置 → 打包接口”导出 ZIP，由用户在打包器手动导入。两软件不通过心跳、队列或自动发送互连。兼容检查由打包器基于当前导入的基础 APK 执行；主题中心导出成功不代表基础包支持全部效果。

“设置 → 运营中心连接”仅连接用户指定的运营服务进行会话预览，不写入 ZIP，不代替打包器配置成品后台。运营内容与主题外观分别管理。

## 原生接入要求

Android 基础 APK 必须实现 hetun-package-v1，提供 assets/hetun-base.json、原生 DEX 和二进制 Manifest。声明的设备、字段和枚举必须有真实原生实现。旧 Kotlin 核心底包不能承载完整编辑器效果。新版完整底包使用共享客户端运行时；包含 theme.skeleton.definition 的主题另需声明并实现 skeleton-definition-v1。缺失能力必须拒绝打包，不能只更改声明而不实现行为。不能把任意第三方 APK 当成已适配底包。

运行时读取 assets/runtime.json、assets/manifest.json 和 assets/assets/ 主题素材。统一业务协议定义在 shared-source/server/native-api.openapi.json；业务后台负责将苹果 CMS（MacCMS）数据、会员与播放转换为此协议。苹果 CMS 是内容系统，iOS 是客户端平台。主题编辑器不负责 CMS 登录、播放鉴权或解析。

iOS、Android、TV 可复用主题数据格式和业务字段，但各端仍需实现自己的渲染器。当前真实二进制重打包仅支持协议 Android APK；IPA/EXE 重打包和真机业务联调尚未完成。

## 版本规则

破坏性协议修改必须升级版本。主题导出的需求摘要不受信任，打包器重新遍历实际主题并检查；本机能力过期或基础包发生变化时不能继续沿用旧兼容结果。签名凭据只由打包器的本机安全存储管理。
