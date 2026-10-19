# 河豚主题中心：多端接入与打包协议 v1

本版在原有主题制作功能上增加客户端交接协议。内容源是苹果 CMS（MacCMS V10），iPhone/iPad 是客户端平台，两者独立。

## 在软件中使用

1. 打开主题库中的一套主题，点击编辑器顶部“多端接入”。
2. 填写正式河豚运营网关地址，如 https://api.example.com 或 https://example.com/gateway。地址不含最后的 /api/catalog 路径。服务须提供 HTTPS，不携带账号、密码、查询参数或片段。
3. 保存接入配置，或直接“保存并导出主题包”。配置随当前主题的草稿、历史、复制与回导保存。
4. 把 ZIP 交给实现协议 v1 的打包器。未填写地址可以导出设计稿，但 clientContract.readiness.configured 为 false，打包器应要求补全后再正式出包。

0.2.10 主题中心全部离线，已移除“连接内容”入口。多端接入窗口只保存、导出正式地址，不探测该地址。configured 只表示已填写有效格式，不表示部署或连接已验证。目录、播放、会员及授权请求由成品客户端与独立运营网关承担；编辑器只预览布局和本机素材。

## 固定包格式与目标端

继续使用 hetun-skeleton v2 / hetun-v2，ZIP 文件仍只有 manifest.json 和 assets/ 素材，避免破坏现有导入器的路径白名单。manifest 新增 clientContract；theme 新增可选 integration：version 为 1，apiBase 为公开服务基址。旧包缺少此字段时默认空地址。

| platform | clientContract.targets | 适配布局 |
|---|---|---|
| mobile | android-phone、ios-iphone | 手机主题 |
| tablet | android-tablet、ios-ipad | 平板主题 |
| tv | android-tv | 遥控器与焦点布局，需电视原生实现 |
| web | web | 网页主题 |

目标端由主题平台固定产生，不能把手机主题任意声明为电视适配。原生 Kotlin/Swift 渲染器需要实现 hetun-v2 字段、页面、模块、素材和交互。此仓库目前提供 Vue/uni-app 预览；增加协议不会把预览代码转换成原生渲染器。

## 客户端与网关协议

clientContract.version=1；包内 clientContract.apiSchema 是 OpenAPI 3.1 规范，含请求和响应结构，可用于后续网关校验及客户端生成。规范源在 shared-source/server/native-api.openapi.json。接口地址为 apiBase + 规范中的路径，基址带 /gateway 等前缀时应使用字符串路径追加，避免 URL 解析丢失前缀。

- GET /api/theme?platform=mobile：返回 theme、version、template、publishedAt。未安装并发布该端主题返回 404。
- GET /api/catalog/categories：返回 items 分类数组，分类含 id、name。
- GET /api/catalog：page、keyword、category、ids 查询；返回 items、page、pages、total。详情也用 ids 查询，影片字段由 OpenAPI 固定。
- POST /api/playback：JSON 的 id 是影片 ID，sid/nid 分别是从 1 开始的线路与集数序号；返回 url、name。列表里的 episodes.url 为空，客户端必须调用播放接口获取地址。
- POST /api/member/login：username、password，返回 token、profile。仅运营网关提供；本机主题服务不开放会员登录。会话当前有效 8 小时，过期后重新登录。
- POST /api/member/logout：使用 Authorization: Bearer token，仅运营网关提供。

所有客户端按相同字段收发 JSON。HTTP 非 2xx 按错误处理，错误体核心字段为 error；401 需要重新登录，403 提示权限，404 提示资源或功能未就绪。主题、目录、播放仍受原有服务授权与 CMS 权限约束，本次没有改变授权边界。播放需要安装 shared-source/server/maccms-extension 中的河豚 CMS 适配文件。仅有 CMS 采集接口不能提供完整登录、收费播放或支付功能。

播放响应目前接受 HTTP(S)，素材也保留旧版 HTTP(S) 配置；原生正式出包应检查远程图片、视频和播放地址的 HTTPS/TLS/格式兼容性，尤其 iOS ATS。此版本不自动修改播放器、实现 DRM、配置第三方视频解析或声称支付已适配。

## 打包器应执行的检查

1. 识别 hetun-skeleton v2、clientContract v1，拒绝不支持的未来协议版本。
2. 确认底包的 OS/设备与 targets 对应；检查底包实际实现了主题渲染字段、图片视频加载、路由、播放和会员桥接。
3. 读取 theme.integration，将正式配置与打包任务配置核对；导入后若主题被修改，重新派生 clientContract，不信任外部包里自称“已兼容”的声明。
4. API 地址未配置或部署接口验证失败时，阻止正式出包。按 OpenAPI 验证实际响应；原生渲染器及打包器适配当前均标记为 required，协议不等于已完成联调。
5. 将 assets/ 相对路径按包根解析，禁止路径穿越；将主题作为数据资源注入受支持底包或源码工程。
6. 安卓通过受支持的底包处理/原生工程编译、对齐、签名生成 APK/AAB；iOS 使用 macOS、Xcode、应用标识、描述文件和签名生成 IPA。APK 与 IPA 不能互相转换。

证书私钥、keystore、p12、描述文件和密码不属于主题包，在打包器的安全存储和构建任务中管理。主题中心只输出公开配置。本次不改打包器，也未在 Android/iOS 真机或任意第三方 APK 上验证；需要用你的客户端源码和打包器完成后续适配。

## 兼容与验证

旧主题包可继续安装；本主题中心会忽略输入包自带的 clientContract 声明，再导出时根据校验后的主题与平台重建。未配置正式服务时仍可保留设计草稿，不将本机预览地址自动打入成品。协议 v1 的破坏性修改应升级版本，不能静默改字段含义。
