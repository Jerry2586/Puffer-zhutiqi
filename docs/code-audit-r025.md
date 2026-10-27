# R025 本地代码审查与瘦身

## 修改前审查

2026-10-27。范围为本项目现役桌面入口、IPC、构建和已退役模块的反向引用。两次独立审查子代理均因429未执行成功，由主线程审查；测试单独记录。

桌面离线入口和发行白名单已不依赖历史Key授权、产品中心、在线更新及本地互连；这些模块和孤立界面仍残留源码与旧测试。非作者模式授权客户端仍被共享服务集成测试使用，移到测试夹具并保留兼容验证。

## 清理决策

删除已核实无现役入口的模块及仅服务这些模块的测试：

- `core/local-link.cjs`
- `core/local-catalog.cjs`
- `core/desktop-authorization.cjs`
- `core/desktop-update.cjs`
- `core/authorization.cjs`
- `core/product-center.cjs`
- `core/terminal-trust.cjs`
- `scripts/authorization-trust.cjs`
- `renderer/settings.html`
- `renderer/settings.css`
- `renderer/settings.js`
- `renderer/workbench/ProductCenter.vue`
- `tests/activation-ui.test.cjs`
- `tests/desktop-update.test.cjs`
- `tests/local-catalog.test.cjs`
- `tests/product-center.test.cjs`
- `tests/product-ui.test.cjs`
- `tests/terminal-live.test.cjs`
- `tests/terminal-trust.test.cjs`
- `core/authorization-ui/app.js`
- `core/authorization-ui/index.html`
- `core/authorization-ui/preload.cjs`
- `core/authorization-ui/style.css`
- `tests/fixtures/terminal-server/README.md`
- `tests/fixtures/terminal-server/server/app.mjs`
- `tests/fixtures/terminal-server/server/authority.mjs`
- `tests/fixtures/terminal-server/server/authorization-log.mjs`
- `tests/fixtures/terminal-server/server/authorization-packages.mjs`
- `tests/fixtures/terminal-server/server/authorization-watch.mjs`
- `tests/fixtures/terminal-server/server/cloudflare.mjs`
- `tests/fixtures/terminal-server/server/communications.mjs`
- `tests/fixtures/terminal-server/server/index.mjs`
- `tests/fixtures/terminal-server/server/instance.mjs`
- `tests/fixtures/terminal-server/server/license.mjs`
- `tests/fixtures/terminal-server/server/migration-stream.mjs`
- `tests/fixtures/terminal-server/server/migration.mjs`
- `tests/fixtures/terminal-server/server/packages.mjs`
- `tests/fixtures/terminal-server/server/product-center.mjs`
- `tests/fixtures/terminal-server/server/self-update.mjs`
- `tests/fixtures/terminal-server/server/software-update.mjs`
- `tests/fixtures/terminal-server/server/store.mjs`
- `tests/fixtures/terminal-server/server/zip.mjs`

保留用户已有文件、备份、历史主题与工作数据。保留打包器原生开发工作流、签名和后台服务目录验证。主题预览和主题服务两个回环监听承担不同职责；不机械合并，也不清理其他项目进程。打包器预览仅显式开启时监听。

## 修改后审查与验证

2026-10-27，由主线程分别完成修改前与修改后审查。两名独立审查探子均因服务429失败，未形成独立审查结论；以下结果不冒充独立审核或AOCI全量语义审核。

审查覆盖退役模块反向引用、主进程与preload IPC一致性、来源校验、界面删除分支、构建文件清单及相对依赖。没有证据表明存在同名函数覆盖，本轮处理的是重复实现、不可达处理器和退役代码。现役调用关系范围内未发现阻塞本次本地候选交付的问题。

两个最终EXE均使用独立测试数据目录实际启动、读取页面和preload，并正常退出。打包器验证离线状态、创建应用及旧云端/更新API不暴露；主题中心验证状态200、ZIP导出200、旧打包接口410、旧发布接口404，无启动/渲染/加载错误。主题服务退出后记录stopped。

端口核验：本轮成品验证创建的调试及服务监听均已退出；用户预览59261与主题服务59260仍保留，职责不同。历史互连使用轮询，删除源码不等于减少真实TCP监听数量。未批量结束其他进程。

AOCI rc21已分别初始化并建立独立MCP绑定，实际握手成功；工作区Codex配置经TOML解析及codex mcp list核对，aoci_packer与aoci_theme均enabled=true。未宣称当前桌面宿主热加载。当前两仓正式Entry均为0、governance_aligned=false；Guide报告code_missing/stale/unbaselined及observed_pending，未复核完的Observed集合没有acknowledge。打包器Bootstrap Plan返回layout_already_volumes，Onboarding返回onboarding_already_volumes，不能以Bootstrap重置已有布局。未生成模板语义、未改Scope或Baseline绕过检查。AOCI完整语义索引与治理对齐尚未完成，最终维护与检查原始结果保存在外部验证目录。

本地候选阶段未推送或发布。用户随后授权正式更新，本批次进入版本提交、CI及Release流程；最终结果以Git标签、Release清单与外部验证记录为准。保留原有未跟踪资料、备份和用户数据。

证据目录：C:/Users/WDDN/AppData/Local/Programs/UniAppTools/validation-r025 。包括各仓before/after测试日志、最终构建日志、smoke-final.json、asar-final.json和aoci-*.json。安装包体积未作同条件前后对比，不声称安装包显著缩小。

### 主题中心结果

- 删除42个退役文件，按Git原始文件字节计260,035字节；包括旧授权/产品中心/互连UI、专用测试和仅被退役测试使用的服务器夹具。
- core/license.cjs原样移动至tests/fixtures/license-server/client.cjs，集成测试保留非作者模式授权兼容验证，移动不计入上述删除字节。
- 构建暂存仅复制5个运行core模块；共享服务的非作者模式逻辑和正在使用的前端组件保留。
- 修改前73项通过；删除退役功能测试后39项通过，0失败0跳过；Vue类型检查、H5编译、本地服务smoke及完整便携版/NSIS构建通过。
- app.asar 277,438字节、17个文件；7个CJS文件与当前源码逐字节一致，静态相对require无缺失。前端与theme-service作为resources另行交付，真实成品导出验证覆盖其加载。
- 旧发行白名单原本就排除了大部分退役源码，本轮主要减少源码与构建暂存负担，不虚报主题安装包大幅缩小。

## 正式发布审查

2026-10-27：发布版本 0.4.2。主线程复核源码差异、运行依赖、IPC边界、发行清单和版本一致性；代码审查与执行测试分开记录。再次请求两仓独立代理审查均因429重试上限失败，不能声称已通过独立代理审核。AOCI为零Entry骨架、治理未对齐，保留未完成状态；不将该结果记为通过。
